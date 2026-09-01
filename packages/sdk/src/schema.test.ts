import { describe, expect, test } from "bun:test";

import {
  defaultSchema,
  validatePageContent,
  validateSchemaCompatibility,
  type PageContent,
} from "./schema";

const validContent: PageContent = {
  version: 1,
  blocks: [
    {
      id: "block-1",
      type: "text",
      data: { text: "Hello" },
    },
  ],
};

describe("OpenCMS schema validation", () => {
  test("accepts content that matches its content type", () => {
    expect(validatePageContent(validContent, defaultSchema, "page")).toBeNull();
  });

  test("rejects a schema update that strands existing page content", () => {
    const schemaWithoutText = {
      ...defaultSchema,
      blocks: {
        heading: defaultSchema.blocks.heading,
      },
      contentTypes: {
        page: {
          ...defaultSchema.contentTypes.page,
          blocks: ["heading"],
        },
      },
    };

    expect(validateSchemaCompatibility(schemaWithoutText, [
      { content: validContent, contentType: "page", slug: "about" },
    ])).toBe('Page "about": Unknown block type: text.');
  });
});
