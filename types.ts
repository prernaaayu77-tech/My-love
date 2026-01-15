
export enum VoiceName {
  KORE = 'Kore',
  PUCK = 'Puck',
  CHARON = 'Charon',
  ZEPHYR = 'Zephyr',
  FENRIR = 'Fenrir'
}

export enum SpeakingStyle {
  STANDARD = 'Standard',
  NATURAL = 'Pure Natural',
  YOUTHFUL = 'Youthful',
  CALM = 'Meditative',
  WISDOM = 'Traditional',
  CHANT = 'Rhythmic',
  AUTHORITATIVE = 'Commanding',
  GENTLE = 'Soft'
}

export type VoiceCategory = 'Boy' | 'Girl' | 'Man' | 'Woman' | 'Elder';

export interface VoiceProfile {
  id: VoiceName;
  displayName: string;
  category: VoiceCategory;
  description: string;
  age: 'Child' | 'Young' | 'Adult' | 'Elder';
  toneInstruction: string;
}

export interface SpeechRequest {
  text: string;
  voice: VoiceName;
  style: SpeakingStyle;
  id: string;
  timestamp: number;
  audioBlob?: Blob;
  status: 'pending' | 'completed' | 'failed';
  type: 'tts' | 'changer' | 'live';
}
