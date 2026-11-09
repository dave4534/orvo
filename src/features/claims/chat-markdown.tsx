import Markdown from "react-markdown";

const ALLOWED = ["p", "ul", "ol", "li", "strong", "em", "br"];

/** Light formatting for the AI chat: paragraphs, short lists, bold. Everything else is dropped to plain text. Logged in docs/exceptions.md. */
export function ChatMarkdown({ children }: { children: string }) {
  return (
    <div className="[&_li]:pl-0.5 [&_ol]:my-1.5 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:mt-2 [&_p:first-child]:mt-0 [&_strong]:font-semibold [&_ul]:my-1.5 [&_ul]:ml-4 [&_ul]:list-disc [&_ul]:space-y-0.5">
      <Markdown allowedElements={ALLOWED} unwrapDisallowed skipHtml>
        {children}
      </Markdown>
    </div>
  );
}
