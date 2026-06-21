// Maps the profile's ISO-639-1 language code (`en`/`es`/`hi`/`pa`, from
// `useProfile().language`) to a BCP-47 locale for speech recognition — both the
// Web Speech API (`recognition.lang`) and Deepgram (`language`) accept these.
// Falls back to en-US for anything unmapped.

const SPEECH_LOCALE: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  hi: "hi-IN",
  pa: "pa-IN",
};

export function speechLocale(language: string): string {
  return SPEECH_LOCALE[language] ?? "en-US";
}
