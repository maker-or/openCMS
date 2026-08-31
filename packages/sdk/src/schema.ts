export type SchemaFieldType = "text" | "slug" | "number" | "boolean";

export interface SchemaField {
  type: SchemaFieldType;
  label?: string;
  required?: boolean;
  unique?: boolean;
}

export interface SchemaBlock {
  label: string;
  fields: Record<string, SchemaField>;
}

export interface SchemaContentType {
  label: string;
  fields: Record<string, SchemaField>;
  blocks?: string[];
}

export interface OpenCmsSchema {
  version: 1;
  blocks: Record<string, SchemaBlock>;
  contentTypes: Record<string, SchemaContentType>;
}

export interface ContentBlock {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface PageContent {
  version: 1;
  blocks: ContentBlock[];
}

export const emptyPageContent: PageContent = { version: 1, blocks: [] };

export const defaultSchema: OpenCmsSchema = {
  version: 1,
  blocks: {
    heading: {
      label: "Heading",
      fields: {
        text: { type: "text", label: "Text", required: true },
        level: { type: "number", label: "Level", required: true },
      },
    },
    text: {
      label: "Text",
      fields: {
        text: { type: "text", label: "Text", required: true },
      },
    },
    quote: {
      label: "Quote",
      fields: {
        text: { type: "text", label: "Quote", required: true },
        author: { type: "text", label: "Author" },
      },
    },
    "feature-list": {
      label: "Feature list",
      fields: {
        title: { type: "text", label: "Title", required: true },
        items: { type: "text", label: "Items", required: true },
      },
    },
  },
  contentTypes: {
    page: {
      label: "Page",
      fields: {
        title: { type: "text", label: "Title", required: true },
        slug: { type: "slug", label: "Slug", required: true, unique: true },
      },
      blocks: ["heading", "text", "quote", "feature-list"],
    },
  },
};
