export function add(a: number, b: number): number {
  return a + b;
}
export function greet(name: string): string {
  return `tables says: hello to ${name}`;
}
export const meaning: { life: number } = {
  life: 42,
};

export function formatExifTable(tags: Partial<ExifReader.Tags>): string {
  const rows: string[] = [];

  if (tags) {
    const fields = [
      { key: "Make", label: "Camera Make" },
      { key: "Model", label: "Camera Model" },
      { key: "DateTimeOriginal", label: "Date Taken" },
      { key: "ExposureTime", label: "Shutter Speed" },
      { key: "FNumber", label: "Aperture" },
      { key: "ISOSpeedRatings", label: "ISO" },
      { key: "FocalLength", label: "Focal Length" },
      { key: "LensModel", label: "Lens" },
      { key: "ImageWidth", label: "Width" },
      { key: "ImageHeight", label: "Height" },
    ];

    for (const { key, label } of fields) {
      const value = tags[key]?.description || tags[key]?.value || "-";
      rows.push(`${label.padEnd(20)} ${value}`);
    }
  }

  return rows.join("\n");
}
