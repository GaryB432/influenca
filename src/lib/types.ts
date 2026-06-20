import ExifReader from "exifreader";

export interface MediaFile {
  path: string;
  filename: string;
  tags?: Partial<ExifReader.Tags>;
  xcamera?: string;
  xtitle?: string;
}

export interface MediaMap {
  [filename: string]: {
    mediaFile: MediaFile;
    clips: string[];
    keywords: string[];
  };
}
