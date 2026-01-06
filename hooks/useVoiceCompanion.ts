import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useRunStore } from '../stores/runStore';
import { useSpotify } from './useSpotify';
import {
  getRealtimeClient,
  createRealtimeSession,
  buildSystemPrompt,
  RealtimeClient,
} from '../lib/openai-realtime';
import { supabase } from '../lib/supabase';

export function useVoiceCompanion() {
  const { user } = useAuth();
  const {
    profile,
    voiceEnabled,
    isRunning,
    runDuration,
    runnerPersona,
    isListening,
    isSpeaking,
    setListening,
    setSpeaking,
  } = useRunStore();

  const {
    currentTrack,
    togglePlayback,
    nextTrack,
    previousTrack,
    search,
    queueTrack,
    spotifyIsPremium,
  } = useSpotify();

  const clientRef = useRef<RealtimeClient | null>(null);
  const isConnectedRef = useRef(false);

  // Handle function calls from the AI
  const handleFunctionCall = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<string> => {
      console.log('Function call:', name, args);

      switch (name) {
        case 'control_music': {
          if (!spotifyIsPremium) {
            return "I'd love to control your music, but you need Spotify Premium for that feature.";
          }

          const action = args.action as string;
          switch (action) {
            case 'play':
              await togglePlayback();
              return 'Playing your music now.';
            case 'pause':
              await togglePlayback();
              return 'Paused your music.';
            case 'next':
              await nextTrack();
              return 'Skipped to the next track.';
            case 'previous':
              await previousTrack();
              return 'Going back to the previous track.';
            case 'queue':
              if (args.query) {
                const tracks = await search(args.query as string);
                if (tracks && tracks.length > 0) {
                  await queueTrack(tracks[0].uri);
                  return `Added "${tracks[0].name}" to your queue.`;
                }
                return "I couldn't find that song.";
              }
              return 'What song would you like me to queue?';
            default:
              return 'I can play, pause, skip, or queue songs for you.';
          }
        }

        case 'get_running_stats': {
          const type = args.type as string;

          const { data: activities } = await supabase
            .from('activities')
            .select('*')
            .eq('user_id', user?.id)
            .order('start_date', { ascending: false });

          if (!activities || activities.length === 0) {
            return "I don't have any running data for you yet. Connect Strava to sync your runs!";
          }

          switch (type) {
            case 'recent': {
              const recent = activities[0];
              const distance = (recent.distance_meters / 1000).toFixed(2);
              const pace = (
                recent.moving_time_seconds /
                60 /
                (recent.distance_meters / 1000)
              ).toFixed(1);
              return `Your last run was ${distance}km at ${pace} minutes per kilometer.`;
            }
            case 'summary': {
              const totalDistance = activities.reduce(
                (sum, a) => sum + a.distance_meters,
                0
              );
              const totalRuns = activities.length;
              return `You've done ${totalRuns} runs totaling ${(totalDistance / 1000).toFixed(0)} kilometers.`;
            }
            case 'weekly': {
              const weekAgo = new Date();
              weekAgo.setDate(weekAgo.getDate() - 7);
              const weekRuns = activities.filter(
                (a) => new Date(a.start_date) > weekAgo
              );
              const weekDistance = weekRuns.reduce(
                (sum, a) => sum + a.distance_meters,
                0
              );
              return `This week you've done ${weekRuns.length} runs covering ${(weekDistance / 1000).toFixed(1)} kilometers.`;
            }
            case 'personal_best': {
              const longestRun = Math.max(
                ...activities.map((a) => a.distance_meters)
              );
              const fastestPace = Math.min(
                ...activities.map(
                  (a) => a.moving_time_seconds / a.distance_meters
                )
              );
              return `Your longest run is ${(longestRun / 1000).toFixed(2)}km. Your fastest pace is ${((fastestPace * 1000) / 60).toFixed(1)} minutes per kilometer.`;
            }
            default:
              return 'I can tell you about your recent runs, weekly summary, or personal bests.';
          }
        }

        case 'save_note': {
          const content = args.content as string;
          if (!content) {
            return 'What would you like me to note down?';
          }

          const { error } = await supabase.from('notes').insert({
            user_id: user?.id,
            content,
            transcription: content,
          });

          if (error) {
            console.error('Error saving note:', error);
            return "I couldn't save that note. Try again later.";
          }

          return `Got it! I've saved your note: "${content}"`;
        }

        case 'get_motivation': {
          const motivations = [
            "You're doing amazing! Every step counts.",
            "Remember why you started. You've got this!",
            "Your body is capable of so much more than your mind thinks.",
            "This run is making you stronger, faster, better.",
            "You're lapping everyone on the couch right now!",
            "Pain is temporary. The feeling of accomplishment lasts forever.",
            "One more mile. You can do anything for one more mile.",
          ];
          return motivations[Math.floor(Math.random() * motivations.length)];
        }

        case 'tell_joke': {
          const jokes = [
            "Why do runners go jogging early in the morning? They want to finish before their brain figures out what they're doing!",
            "I'm not slow, I'm just enjoying the scenery... very thoroughly.",
            "Running is a mental sport, and we're all insane.",
            "Why did the runner join a band? Because they had great running beats!",
            "I tried running away from my problems. Turns out I have great cardio but terrible life choices.",
            "What's a runner's favorite type of story? A running gag!",
          ];
          return jokes[Math.floor(Math.random() * jokes.length)];
        }

        default:
          return "I'm not sure how to help with that, but I'm here for you!";
      }
    },
    [user, spotifyIsPremium, togglePlayback, nextTrack, previousTrack, search, queueTrack]
  );

  // Store refs for stable callbacks
  const setListeningRef = useRef(setListening);
  const setSpeakingRef = useRef(setSpeaking);

  useEffect(() => {
    setListeningRef.current = setListening;
    setSpeakingRef.current = setSpeaking;
  }, [setListening, setSpeaking]);

  // Connect to OpenAI Realtime when voice is enabled and running
  const connect = useCallback(async () => {
    if (isConnectedRef.current) return;

    try {
      const client = getRealtimeClient();
      clientRef.current = client;

      // Set up handlers
      client.setHandlers({
        onMessage: (message) => {
          console.log('AI message:', message);
        },
        onFunctionCall: handleFunctionCall,
        onError: (error) => {
          console.error('Voice companion error:', error);
          setListeningRef.current(false);
          setSpeakingRef.current(false);
        },
        onSpeaking: (speaking) => {
          setSpeakingRef.current(speaking);
        },
        onListening: (listening) => {
          setListeningRef.current(listening);
        },
      });

      // Build system prompt
      const prompt = buildSystemPrompt(
        profile?.full_name || 'Runner',
        runnerPersona,
        currentTrack,
        isRunning,
        runDuration
      );
      client.setSystemPrompt(prompt);

      // Get ephemeral token and connect
      const token = await createRealtimeSession();
      await client.connect(token);

      isConnectedRef.current = true;
    } catch (error) {
      console.error('Failed to connect voice companion:', error);
    }
  }, [
    profile,
    runnerPersona,
    currentTrack,
    isRunning,
    runDuration,
    handleFunctionCall,
  ]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    isConnectedRef.current = false;
    setListeningRef.current(false);
    setSpeakingRef.current(false);
  }, []);

  // Auto-connect when running with voice enabled
  useEffect(() => {
    if (voiceEnabled && isRunning) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceEnabled, isRunning]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (clientRef.current) {
      if (isListening) {
        clientRef.current.setMuted(true);
        setListeningRef.current(false);
      } else {
        clientRef.current.setMuted(false);
        setListeningRef.current(true);
      }
    }
  }, [isListening]);

  // Send text message (for testing or accessibility)
  const sendMessage = useCallback((text: string) => {
    if (clientRef.current) {
      clientRef.current.sendMessage(text);
    }
  }, []);

  return {
    isConnected: isConnectedRef.current,
    isListening,
    isSpeaking,
    connect,
    disconnect,
    toggleListening,
    sendMessage,
  };
}
