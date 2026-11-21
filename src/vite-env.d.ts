/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'virtual:catalog' {
  const data: {
    regions: { unlock_every_sessions: number; regions: import('./content/schema').Region[]; links: [string, string][] };
    lessons: import('./content/schema').LessonMeta[];
    gates: import('./content/schema').Gate[];
  };
  export default data;
}
