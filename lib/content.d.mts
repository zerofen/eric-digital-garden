export interface Heading {
  id: string;
  text: string;
  depth: number;
}
export interface Post {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  draft: boolean;
  example: boolean;
  readingMinutes: number;
  html: string;
  headings: Heading[];
}
export interface Project {
  title: string;
  description: string;
  tags?: string[];
  url?: string;
  status?: string;
}
export interface Book {
  title: string;
  author: string;
  note?: string;
  status?: string;
  url?: string;
}
export interface Track {
  title: string;
  artist: string;
  note?: string;
  url?: string;
  audio?: string;
}
export interface Moment {
  date: string;
  text: string;
  example?: boolean;
}
export interface Collections {
  projects: Project[];
  books: Book[];
  music: Track[];
  moments: Moment[];
}
export function parsePost(source: string, slug: string): Post;
export function getPosts(options?: { includeDrafts?: boolean }): Post[];
export function getPost(slug: string): Post | undefined;
export function getCollections(): Collections;
export function getSite(): typeof import('../content/site.json');
export function validateContent(): {
  site: ReturnType<typeof getSite>;
  collections: Collections;
  posts: Post[];
};
