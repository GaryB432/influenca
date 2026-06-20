import ExifReader from "exifreader";

export interface MediaFile {
  filename: string;
  path: string;
  tags?: Partial<ExifReader.Tags>;
  xcamera?: string;
  xtitle?: string;
}

export interface MediaMap {
  [filename: string]: {
    clips: string[];
    keywords: string[];
    mediaFile: MediaFile;
  };
}
