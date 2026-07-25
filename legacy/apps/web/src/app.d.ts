/* eslint-disable @typescript-eslint/no-empty-object-type */

declare global {
  namespace App {
    interface Locals {
      user: null | User;
    }
    interface PageData {}
    interface PageState {}
    interface Platform {}
    interface User {
      email: string;
      id: string;
      role: "admin" | "editor" | "user";
    }
  }
}

export type TranscriptionResponse = {
  videoEntry: VideoEntry;
  vtt: TranscriptionSegment[];
};
