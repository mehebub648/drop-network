import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Language = 'en' | 'bn';
const copy = {
  en: { find: 'Find Blood', requests: 'Live Requests', profile: 'My Profile', about: 'About', safety: 'Safety', login: 'Log in', donor: 'Become a Donor', logout: 'Log out', language: 'বাংলা' },
  bn: { find: 'রক্ত খুঁজুন', requests: 'সক্রিয় অনুরোধ', profile: 'আমার প্রোফাইল', about: 'পরিচিতি', safety: 'নিরাপত্তা', login: 'লগ ইন', donor: 'রক্তদাতা হোন', logout: 'লগ আউট', language: 'English' }
} as const;

const LocaleContext = createContext({ language: 'en' as Language, setLanguage: (_language: Language) => {}, t: copy.en });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('drop_language') === 'bn' ? 'bn' : 'en');
  useEffect(() => { localStorage.setItem('drop_language', language); document.documentElement.lang = language; }, [language]);
  return <LocaleContext.Provider value={{ language, setLanguage, t: copy[language] }}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
