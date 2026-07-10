import { describe, expect, test } from "vitest";
import { Database, listMedia } from "./database";

describe("Database", () => {
  test("exists as a thing it itself", async () => {
    const db = new Database("tests/fixtures/media");
    await db.read();
    expect(listMedia(db)).toMatchInlineSnapshot(`
      "An exciting time at the park > test
      PXL_20260203_141534372.jpg > test"
    `);
  });
});
