// OpenAI Realtime API Client for Voice Companion
// Uses WebRTC for low-latency voice communication

import {
  mediaDevices,
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
} from 'react-native-webrtc';
import type { RunnerPersona, SpotifyTrack } from '../types';
import { supabase } from './supabase';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Function definitions for the AI
const AI_FUNCTIONS = [
  {
    name: 'control_music',
    description: 'Control Spotify playback - play, pause, skip, previous, or queue a song',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['play', 'pause', 'next', 'previous', 'queue'],
          description: 'The playback action to perform',
        },
        query: {
          type: 'string',
          description: 'Search query for queueing a specific song (only for queue action)',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'get_running_stats',
    description: 'Get the user\'s running statistics and history',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['recent', 'summary', 'personal_best', 'weekly'],
          description: 'Type of stats to retrieve',
        },
      },
      required: ['type'],
    },
  },
  {
    name: 'save_note',
    description: 'Save a voice note or reminder for the user',
    parameters: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The note content to save',
        },
      },
      required: ['content'],
    },
  },
  {
    name: 'get_motivation',
    description: 'Get a motivational message or running tip',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['motivation', 'tip', 'quote'],
          description: 'Type of motivational content',
        },
      },
    },
  },
  {
    name: 'tell_joke',
    description: 'Tell the user a joke',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['general', 'running', 'dad'],
          description: 'Category of joke',
        },
      },
    },
  },
];

// Build system prompt with user context
export function buildSystemPrompt(
  userName: string,
  runnerPersona: RunnerPersona | null,
  currentTrack: SpotifyTrack | null,
  isRunning: boolean,
  runDuration: number
): string {
  let prompt = `You are Runna, a friendly and energetic running companion. You're talking to ${userName}.`;

  if (isRunning) {
    const mins = Math.floor(runDuration / 60);
    prompt += ` They've been running for ${mins} minutes.`;
  }

  if (runnerPersona) {
    prompt += `

About this runner:
- Typical distance: ${runnerPersona.typical_distance_km}km
- Average pace: ${runnerPersona.average_pace_min_per_km} min/km
- Favorite run time: ${runnerPersona.preferred_run_time}
- Runs per week: ${runnerPersona.running_frequency.toFixed(1)}
- Total runs tracked: ${runnerPersona.total_runs}`;

    if (runnerPersona.recent_accomplishments.length > 0) {
      prompt += `
- Recent accomplishments: ${runnerPersona.recent_accomplishments.join(', ')}`;
    }
  }

  if (currentTrack) {
    prompt += `

Currently playing: "${currentTrack.name}" by ${currentTrack.artists.map((a) => a.name).join(', ')}`;
  }

  prompt += `

You can:
- Control their music (play, pause, skip, queue songs)
- Tell them jokes, news, or motivational stories
- Answer questions about their running stats
- Save notes and reminders for them

Important guidelines:
- Keep responses SHORT and conversational - they're running!
- Be encouraging but not annoying
- Match their energy level
- If they seem tired, be supportive
- If they seem energized, be enthusiastic
- Use natural speech patterns, not robotic responses`;

  return prompt;
}

// Realtime API session configuration
export interface RealtimeSession {
  sessionId: string;
  isConnected: boolean;
  onMessage: (message: string) => void;
  onFunctionCall: (name: string, args: Record<string, unknown>) => Promise<string>;
  onError: (error: Error) => void;
  onSpeaking: (speaking: boolean) => void;
}

// Create ephemeral token for client-side connection
export async function createRealtimeSession(): Promise<string> {
  // In production, this should go through your backend for security
  const { data, error } = await supabase.functions.invoke('openai-session', {
    body: {},
  });

  if (error) {
    console.error('OpenAI session error details:', {
      message: error.message,
      name: error.name,
      context: error.context,
    });
    throw error;
  }

  if (!data?.client_secret) {
    console.error('OpenAI session response missing client_secret:', data);
    throw new Error('No client_secret in response');
  }

  console.log('OpenAI session created successfully');
  return data.client_secret;
}

// WebRTC connection manager for Realtime API
export class RealtimeClient {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private mediaStream: MediaStream | null = null;

  private onMessage: ((message: string) => void) | null = null;
  private onFunctionCall:
    | ((name: string, args: Record<string, unknown>) => Promise<string>)
    | null = null;
  private onError: ((error: Error) => void) | null = null;
  private onSpeaking: ((speaking: boolean) => void) | null = null;
  private onListening: ((listening: boolean) => void) | null = null;

  private systemPrompt: string = '';

  constructor() {
    // No audio element needed for React Native - audio plays automatically via WebRTC
  }

  setHandlers(handlers: {
    onMessage?: (message: string) => void;
    onFunctionCall?: (
      name: string,
      args: Record<string, unknown>
    ) => Promise<string>;
    onError?: (error: Error) => void;
    onSpeaking?: (speaking: boolean) => void;
    onListening?: (listening: boolean) => void;
  }) {
    this.onMessage = handlers.onMessage || null;
    this.onFunctionCall = handlers.onFunctionCall || null;
    this.onError = handlers.onError || null;
    this.onSpeaking = handlers.onSpeaking || null;
    this.onListening = handlers.onListening || null;
  }

  setSystemPrompt(prompt: string) {
    this.systemPrompt = prompt;
  }

  async connect(ephemeralToken: string): Promise<void> {
    try {
      // Create peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });

      // Set up audio playback - React Native WebRTC handles audio automatically
      this.peerConnection.ontrack = (event: any) => {
        console.log('Received remote audio track');
        // Audio will play automatically in React Native WebRTC
      };

      // Get user's microphone using React Native WebRTC mediaDevices
      this.mediaStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      }) as MediaStream;

      // Add audio track to connection
      this.mediaStream.getTracks().forEach((track: any) => {
        this.peerConnection!.addTrack(track, this.mediaStream!);
      });

      // Create data channel for events
      this.dataChannel = this.peerConnection.createDataChannel('oai-events');
      this.setupDataChannel();

      // Create and set local description
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await this.peerConnection.setLocalDescription(offer);

      // Connect to OpenAI Realtime API
      // Use XMLHttpRequest directly to avoid issues with whatwg-fetch polyfill and non-JSON bodies
      console.log('Connecting to OpenAI Realtime API...');
      const response = await new Promise<{ ok: boolean; status: number; text: () => Promise<string> }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview');
        xhr.setRequestHeader('Authorization', `Bearer ${ephemeralToken}`);
        xhr.setRequestHeader('Content-Type', 'application/sdp');

        xhr.onload = () => {
          console.log('OpenAI Realtime API response status:', xhr.status);
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            text: () => Promise.resolve(xhr.responseText),
          });
        };

        xhr.onerror = () => {
          console.error('OpenAI Realtime API network error:', xhr.status, xhr.responseText);
          reject(new TypeError('Network request failed'));
        };

        xhr.ontimeout = () => {
          console.error('OpenAI Realtime API timeout');
          reject(new TypeError('Network request timed out'));
        };

        xhr.send(offer.sdp);
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI Realtime API error details:', errorText);
        throw new Error(`Failed to connect: ${response.status} ${errorText}`);
      }

      const answerSdp = await response.text();
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: answerSdp })
      );

      // Configure session after connection
      this.configureSession();
    } catch (error) {
      this.onError?.(error as Error);
      throw error;
    }
  }

  private setupDataChannel() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Realtime data channel opened');
      this.configureSession();
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleServerEvent(data);
      } catch (error) {
        console.error('Error parsing server event:', error);
      }
    };

    this.dataChannel.onerror = (error) => {
      console.error('Data channel error:', error);
      this.onError?.(new Error('Data channel error'));
    };
  }

  private configureSession() {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') return;

    // Configure session with our settings
    const sessionConfig = {
      type: 'session.update',
      session: {
        instructions: this.systemPrompt,
        voice: 'alloy',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
        tools: AI_FUNCTIONS.map((fn) => ({
          type: 'function',
          ...fn,
        })),
      },
    };

    this.dataChannel.send(JSON.stringify(sessionConfig));
  }

  private handleServerEvent(event: Record<string, unknown>) {
    switch (event.type) {
      case 'session.created':
        console.log('Session created');
        break;

      case 'input_audio_buffer.speech_started':
        this.onListening?.(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        this.onListening?.(false);
        break;

      case 'response.audio.delta':
        this.onSpeaking?.(true);
        break;

      case 'response.audio.done':
        this.onSpeaking?.(false);
        break;

      case 'response.text.delta':
        // Accumulate text response
        if (event.delta && typeof event.delta === 'string') {
          // Could accumulate here if needed
        }
        break;

      case 'response.text.done':
        if (event.text && typeof event.text === 'string') {
          this.onMessage?.(event.text);
        }
        break;

      case 'response.function_call_arguments.done':
        this.handleFunctionCall(event);
        break;

      case 'error':
        console.error('Realtime API error:', event);
        this.onError?.(new Error((event.error as Record<string, string>)?.message || 'Unknown error'));
        break;
    }
  }

  private async handleFunctionCall(event: Record<string, unknown>) {
    const name = event.name as string;
    const callId = event.call_id as string;
    let args: Record<string, unknown> = {};

    try {
      args = JSON.parse(event.arguments as string);
    } catch {
      args = {};
    }

    try {
      const result = await this.onFunctionCall?.(name, args);

      // Send function result back
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(
          JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id: callId,
              output: result || 'Done',
            },
          })
        );

        // Request response continuation
        this.dataChannel.send(
          JSON.stringify({
            type: 'response.create',
          })
        );
      }
    } catch (error) {
      console.error('Function call error:', error);
    }
  }

  // Send a text message to the conversation
  sendMessage(text: string) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      console.error('Data channel not ready');
      return;
    }

    this.dataChannel.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text,
            },
          ],
        },
      })
    );

    this.dataChannel.send(
      JSON.stringify({
        type: 'response.create',
      })
    );
  }

  // Mute/unmute microphone
  setMuted(muted: boolean) {
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track: any) => {
        track.enabled = !muted;
      });
    }
  }

  // Disconnect and cleanup
  disconnect() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track: any) => track.stop());
      this.mediaStream = null;
    }

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }
}

// Singleton instance
let realtimeClient: RealtimeClient | null = null;

export function getRealtimeClient(): RealtimeClient {
  if (!realtimeClient) {
    realtimeClient = new RealtimeClient();
  }
  return realtimeClient;
}
