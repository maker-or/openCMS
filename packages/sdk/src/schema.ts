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

export interface SchemaContentRecord {
  slug: string;
  contentType: string;
  content: PageContent;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldValueError(field: SchemaField, value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;

  const valid = field.type === "number"
    ? typeof value === "number" && Number.isFinite(value)
    : field.type === "boolean"
      ? typeof value === "boolean"
      : typeof value === "string";

  return valid ? null : `${label} must be a ${field.type}.`;
}

export function validatePageContent(
  content: PageContent,
  schema: OpenCmsSchema,
  contentType: string,
): string | null {
  const definition = schema.contentTypes[contentType];
  if (!definition) return `Unknown content type: ${contentType}.`;

  for (const [index, block] of content.blocks.entries()) {
    if (!isRecord(block) || typeof block.id !== "string" || typeof block.type !== "string" || !isRecord(block.data)) {
      return `Block ${index + 1} must define an id, type, and data object.`;
    }
    const blockDefinition = schema.blocks[block.type];
    if (!blockDefinition) return `Unknown block type: ${block.type}.`;
    if (definition.blocks && !definition.blocks.includes(block.type)) {
      return `Block ${block.type} is not allowed in ${contentType}.`;
    }
    for (const [fieldName, field] of Object.entries(blockDefinition.fields)) {
      const value = block.data[fieldName];
      if (field.required && (value === undefined || value === "")) {
        return `${blockDefinition.label} requires ${field.label ?? fieldName}.`;
      }
      const error = fieldValueError(field, value, field.label ?? fieldName);
      if (error) return error;
    }
  }
  return null;
}

export function validateSchemaCompatibility(
  schema: OpenCmsSchema,
  pages: SchemaContentRecord[],
): string | null {
  for (const page of pages) {
    const error = validatePageContent(page.content, schema, page.contentType);
    if (error) return `Page "${page.slug}": ${error}`;
  }
  return null;
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
