import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import type { JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  CheckSquare,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Table2,
  Underline,
  Undo2,
} from "lucide-react";
import "./minute-rich-editor.css";

export type MinuteDocument = JSONContent;
type MinuteLegacy = {
  summary?: string | null;
  decisions?: string | null;
  followUps?: string | null;
  content?: MinuteDocument | null;
};
const textBlock = (value: string): JSONContent => ({
  type: "paragraph",
  content: value ? [{ type: "text", text: value }] : [],
});
export function initialMinuteDocument(
  minute?: MinuteLegacy | null,
): MinuteDocument {
  if (minute?.content?.type === "doc") return minute.content;
  const blocks: JSONContent[] = [];
  const section = (title: string, value: string) => {
    blocks.push({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: title }],
    });
    for (const line of value.split("\n")) blocks.push(textBlock(line));
  };
  if (minute) {
    section("شرح جلسه", minute.summary || "");
    if (minute.decisions) section("تصمیم‌ها", minute.decisions);
    if (minute.followUps) section("پیگیری‌ها و اقدام‌ها", minute.followUps);
  } else {
    return { type: "doc", content: [textBlock("")] };
  }
  return { type: "doc", content: blocks };
}

function Tool({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={"minute-tool" + (active ? " is-active" : "")}
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function MinuteRichEditor({
  content,
  onChange,
  readOnly = false,
}: {
  content: MinuteDocument;
  onChange?: (content: MinuteDocument, text: string) => void;
  readOnly?: boolean;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [, rerender] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TableKit,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        defaultAlignment: "right",
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: "شرح جلسه، تصمیم‌ها و اقدام‌های بعدی را بنویسید…",
      }),
    ],
    content,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        dir: "rtl",
        class: "minute-prose",
        "aria-label": "متن کامل صورت‌جلسه",
      },
    },
    onUpdate: ({ editor: current }) =>
      onChangeRef.current?.(
        current.getJSON(),
        current.getText({ blockSeparator: " " }),
      ),
  });
  useEffect(() => {
    if (!editor) return;
    const update = () => rerender((value) => value + 1);
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
    };
  }, [editor]);
  if (!editor)
    return (
      <div className="minute-editor-loading">در حال آماده‌سازی ویرایشگر…</div>
    );
  const applyLink = () => {
    const value = link.trim();
    if (!/^https?:\/\/|^mailto:/i.test(value)) {
      setLinkError("آدرس باید با https://، http:// یا mailto: شروع شود.");
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: value })
      .run();
    setLinkOpen(false);
    setLinkError("");
  };
  return (
    <div className={"minute-rich-editor" + (readOnly ? " is-readonly" : "")}>
      {!readOnly && (
        <>
          <div
            className="minute-editor-toolbar"
            role="toolbar"
            aria-label="ابزارهای قالب‌بندی صورت‌جلسه"
          >
            <div className="minute-tool-group">
              <Tool
                label="متن عادی"
                active={editor.isActive("paragraph")}
                onClick={() => editor.chain().focus().setParagraph().run()}
              >
                <Pilcrow size={16} />
              </Tool>
              <Tool
                label="عنوان اصلی"
                active={editor.isActive("heading", { level: 2 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 2 }).run()
                }
              >
                <Heading2 size={17} />
              </Tool>
              <Tool
                label="زیرعنوان"
                active={editor.isActive("heading", { level: 3 })}
                onClick={() =>
                  editor.chain().focus().toggleHeading({ level: 3 }).run()
                }
              >
                <Heading3 size={17} />
              </Tool>
            </div>
            <div className="minute-tool-group">
              <Tool
                label="پررنگ"
                active={editor.isActive("bold")}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <Bold size={16} />
              </Tool>
              <Tool
                label="مورب"
                active={editor.isActive("italic")}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <Italic size={16} />
              </Tool>
              <Tool
                label="زیرخط"
                active={editor.isActive("underline")}
                onClick={() => editor.chain().focus().toggleUnderline().run()}
              >
                <Underline size={16} />
              </Tool>
              <Tool
                label="خط‌خورده"
                active={editor.isActive("strike")}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              >
                <Strikethrough size={16} />
              </Tool>
              <Tool
                label="برجسته‌سازی"
                active={editor.isActive("highlight")}
                onClick={() => editor.chain().focus().toggleHighlight().run()}
              >
                <Highlighter size={16} />
              </Tool>
            </div>
            <div className="minute-tool-group">
              <Tool
                label="فهرست نشانه‌دار"
                active={editor.isActive("bulletList")}
                onClick={() => editor.chain().focus().toggleBulletList().run()}
              >
                <List size={16} />
              </Tool>
              <Tool
                label="فهرست شماره‌دار"
                active={editor.isActive("orderedList")}
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
              >
                <ListOrdered size={16} />
              </Tool>
              <Tool
                label="فهرست کارها"
                active={editor.isActive("taskList")}
                onClick={() => editor.chain().focus().toggleTaskList().run()}
              >
                <CheckSquare size={16} />
              </Tool>
              <Tool
                label="نقل قول"
                active={editor.isActive("blockquote")}
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
              >
                <Quote size={16} />
              </Tool>
            </div>
            <div className="minute-tool-group">
              <Tool
                label="راست‌چین"
                active={editor.isActive({ textAlign: "right" })}
                onClick={() =>
                  editor.chain().focus().setTextAlign("right").run()
                }
              >
                <AlignRight size={16} />
              </Tool>
              <Tool
                label="وسط‌چین"
                active={editor.isActive({ textAlign: "center" })}
                onClick={() =>
                  editor.chain().focus().setTextAlign("center").run()
                }
              >
                <AlignCenter size={16} />
              </Tool>
              <Tool
                label="چپ‌چین"
                active={editor.isActive({ textAlign: "left" })}
                onClick={() =>
                  editor.chain().focus().setTextAlign("left").run()
                }
              >
                <AlignLeft size={16} />
              </Tool>
            </div>
            <div className="minute-tool-group">
              <Tool
                label="افزودن پیوند"
                active={editor.isActive("link")}
                onClick={() => {
                  setLink(editor.getAttributes("link").href || "");
                  setLinkOpen((value) => !value);
                }}
              >
                <Link2 size={16} />
              </Tool>
              <Tool
                label="افزودن جدول"
                onClick={() =>
                  editor
                    .chain()
                    .focus()
                    .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                    .run()
                }
              >
                <Table2 size={16} />
              </Tool>
              <Tool
                label="خط جداکننده"
                onClick={() => editor.chain().focus().setHorizontalRule().run()}
              >
                <Minus size={16} />
              </Tool>
              <Tool
                label="پاک کردن قالب‌بندی"
                onClick={() =>
                  editor.chain().focus().unsetAllMarks().clearNodes().run()
                }
              >
                <RemoveFormatting size={16} />
              </Tool>
            </div>
            <div className="minute-tool-group">
              <Tool
                label="بازگشت"
                disabled={!editor.can().undo()}
                onClick={() => editor.chain().focus().undo().run()}
              >
                <Undo2 size={16} />
              </Tool>
              <Tool
                label="تکرار"
                disabled={!editor.can().redo()}
                onClick={() => editor.chain().focus().redo().run()}
              >
                <Redo2 size={16} />
              </Tool>
            </div>
          </div>
          {linkOpen && (
            <div className="minute-link-form">
              <label>
                آدرس پیوند
                <input
                  type="url"
                  value={link}
                  onChange={(event) => {
                    setLink(event.target.value);
                    setLinkError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyLink();
                    }
                  }}
                  placeholder="https://example.com"
                  autoFocus
                />
              </label>
              <button type="button" onClick={applyLink}>
                ثبت پیوند
              </button>
              {editor.isActive("link") && (
                <button
                  type="button"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setLinkOpen(false);
                  }}
                >
                  حذف پیوند
                </button>
              )}
              {linkError && <span role="alert">{linkError}</span>}
            </div>
          )}
          {editor.isActive("table") && (
            <div
              className="minute-table-toolbar"
              role="toolbar"
              aria-label="ویرایش جدول"
            >
              <button
                type="button"
                onClick={() => editor.chain().focus().addRowAfter().run()}
              >
                افزودن ردیف
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().addColumnAfter().run()}
              >
                افزودن ستون
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteRow().run()}
              >
                حذف ردیف
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteColumn().run()}
              >
                حذف ستون
              </button>
              <button
                type="button"
                onClick={() => editor.chain().focus().deleteTable().run()}
              >
                حذف جدول
              </button>
            </div>
          )}
        </>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
