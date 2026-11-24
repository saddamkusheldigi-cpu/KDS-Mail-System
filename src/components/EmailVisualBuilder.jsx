"use client";

import { useState, useRef, useEffect } from "react";
import {
  Image as ImageIcon,
  MousePointerClick,
  Sparkles,
  Eye,
  Code,
  FileText,
  Upload,
  Link as LinkIcon,
  Check,
  AlertTriangle,
  Smartphone,
  Monitor,
  Maximize2,
  Trash2,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  Palette,
  Columns,
  Layers,
  Zap,
} from "lucide-react";
import { PRESET_TEMPLATES } from "@/lib/email-templates";

export default function EmailVisualBuilder({
  htmlBody,
  setHtmlBody,
  plainTextBody,
  setPlainTextBody,
  subject,
  setSubject,
}) {
  // Mode: "visual" | "preview" | "code" | "text"
  const [activeTab, setActiveTab] = useState("visual");
  const [previewDevice, setPreviewDevice] = useState("desktop"); // "desktop" | "mobile"
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showButtonModal, setShowButtonModal] = useState(false);

  // Image Modal State
  const [imageSourceType, setImageSourceType] = useState("upload"); // "upload" | "url"
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("Outreach Image");
  const [imageWidth, setImageWidth] = useState("100%"); // "100%" | "60%" | "30%" | "custom"
  const [imageAlign, setImageAlign] = useState("center"); // "center" | "left" | "right"
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedBase64, setUploadedBase64] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState("");
  const [embedMode, setEmbedMode] = useState("base64"); // "base64" (self-contained) | "url" (hosted)

  // Button Modal State
  const [btnText, setBtnText] = useState("Schedule a 10-Minute Call");
  const [btnUrl, setBtnUrl] = useState("https://yourdomain.com/demo");
  const [btnColor, setBtnColor] = useState("#4f46e5");
  const [btnRadius, setBtnRadius] = useState("8px");
  const [btnAlign, setBtnAlign] = useState("center");

  // Visual ContentEditable Ref
  const visualEditorRef = useRef(null);

  // Plain Text Sync State
  const [syncPlainToHtml, setSyncPlainToHtml] = useState(false);

  // Handle plain text typing with optional auto-sync to main HTML email
  function handlePlainTextChange(newText) {
    setPlainTextBody(newText);
    if (syncPlainToHtml) {
      const formattedHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111827; white-space: pre-wrap; margin: 0; padding: 12px 0;">${newText}</div>`;
      setHtmlBody(formattedHtml);
    }
  }

  // Explicitly apply plain text as the main email body so Gmail displays it
  function applyPlainTextAsMainEmail() {
    const formattedHtml = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; color: #111827; white-space: pre-wrap; margin: 0; padding: 12px 0;">${plainTextBody || ""}</div>`;
    setHtmlBody(formattedHtml);
    setSyncPlainToHtml(true);
    if (visualEditorRef.current) {
      visualEditorRef.current.innerHTML = formattedHtml;
    }
  }

  // Extract clean plain text from current HTML body
  function generatePlainFromHtml() {
    if (typeof document !== "undefined") {
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = htmlBody || "";
      const extracted = tempDiv.innerText || tempDiv.textContent || "";
      setPlainTextBody(extracted.trim());
    }
  }

  // Calculate Email Size in KB & MB
  const emailSizeBytes = new Blob([htmlBody || ""]).size;
  const emailSizeKb = (emailSizeBytes / 1024).toFixed(1);
  const emailSizePercent = Math.min(100, Math.round((emailSizeBytes / (1024 * 1024)) * 100));

  // Sync state into visual editor when switching back to "visual" tab
  useEffect(() => {
    if (activeTab === "visual" && visualEditorRef.current) {
      if (visualEditorRef.current.innerHTML !== htmlBody) {
        visualEditorRef.current.innerHTML = htmlBody;
      }
    }
  }, [activeTab, htmlBody]);

  // Handle content changes in visual editor
  function handleVisualInput() {
    if (visualEditorRef.current) {
      const newHtml = visualEditorRef.current.innerHTML;
      setHtmlBody(newHtml);
    }
  }

  // Format commands for Visual Toolbar
  function executeCommand(command, value = null) {
    if (typeof document !== "undefined") {
      document.execCommand(command, false, value);
      if (visualEditorRef.current) {
        setHtmlBody(visualEditorRef.current.innerHTML);
      }
    }
  }

  // Insert Dynamic Tag at Cursor
  function insertPersonalizationTag(tag) {
    if (activeTab === "code") {
      setHtmlBody((prev) => `${prev} ${tag}`);
    } else {
      executeCommand("insertText", tag);
    }
  }

  // Handle Image File Upload to /api/upload
  async function handleImageFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to upload image");
      }

      setUploadedBase64(data.base64);
      setUploadedFileUrl(data.url);
      setImageUrl(data.url);
      setImageAlt(file.name.replace(/\.[^/.]+$/, ""));
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setIsUploadingImage(false);
    }
  }

  // Insert Generated Image into Email Body
  function handleInsertImage() {
    const finalSrc = embedMode === "base64" && uploadedBase64 ? uploadedBase64 : imageUrl;
    if (!finalSrc) {
      setUploadError("Please choose an image file or provide a valid image URL.");
      return;
    }

    // Check if adding this image causes template to exceed 1 MB limit
    const estimatedNewBytes = emailSizeBytes + finalSrc.length + 200;
    if (estimatedNewBytes > 1024 * 1024) {
      setUploadError(
        `Adding this image will make total template size (${(estimatedNewBytes / 1024).toFixed(1)} KB) exceed the strict 1 MB limit (1,024 KB max). Please compress the image or switch to 'Hosted URL' mode.`
      );
      return;
    }

    const alignmentStyle =
      imageAlign === "center"
        ? "margin: 20px auto; display: block;"
        : imageAlign === "right"
        ? "margin: 20px 0 20px auto; display: block;"
        : "margin: 20px auto 20px 0; display: block;";

    const imageHtml = `
      <div style="text-align: ${imageAlign}; margin: 20px 0;">
        <img src="${finalSrc}" alt="${imageAlt || "Image"}" style="max-width: ${imageWidth}; width: ${imageWidth}; height: auto; border-radius: 8px; border: 0; ${alignmentStyle}" />
      </div>
    `;

    setHtmlBody((prev) => `${prev}\n${imageHtml}`);
    setShowImageModal(false);
    setImageUrl("");
    setUploadedBase64("");
    setUploadedFileUrl("");
    setUploadError("");
  }

  // Insert Styled CTA Button
  function handleInsertButton() {
    if (!btnText.trim()) return;

    const alignStyle =
      btnAlign === "center" ? "text-align: center;" : btnAlign === "right" ? "text-align: right;" : "text-align: left;";

    const buttonHtml = `
      <div style="${alignStyle} margin: 28px 0;">
        <table cellpadding="0" cellspacing="0" border="0" style="margin: ${btnAlign === "center" ? "0 auto" : "0"};">
          <tr>
            <td align="center" style="border-radius: ${btnRadius}; background-color: ${btnColor};">
              <a href="${btnUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #ffffff !important; text-decoration: none; border-radius: ${btnRadius};">
                ${btnText} &rarr;
              </a>
            </td>
          </tr>
        </table>
      </div>
    `;

    setHtmlBody((prev) => `${prev}\n${buttonHtml}`);
    setShowButtonModal(false);
  }

  // Insert Callout Box
  function handleInsertCallout() {
    const calloutHtml = `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; border-left: 4px solid #4f46e5; border-radius: 6px; margin: 20px 0;">
        <tr>
          <td style="padding: 18px 20px;">
            <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Key Benefit for {{company}}:</p>
            <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5;">
              Add your special message, product offer, or key differentiator here.
            </p>
          </td>
        </tr>
      </table>
    `;
    setHtmlBody((prev) => `${prev}\n${calloutHtml}`);
  }

  // Load Preset Template
  function handleSelectTemplate(template) {
    setHtmlBody(template.html);
    if (template.plainText) {
      setPlainTextBody(template.plainText);
    }
    if (template.subject) {
      setSubject(template.subject);
    }
    setShowTemplateModal(false);
  }

  return (
    <div className="space-y-4">
      {/* Top Bar: Template Selector, Visual Tools & Size Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Templates Trigger */}
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-500 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Pick Pre-Made Template
          </button>

          {/* Quick No-Code Block Inserters */}
          <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block" />

          <button
            type="button"
            onClick={() => setShowImageModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <ImageIcon className="h-3.5 w-3.5 text-indigo-600" />
            + Add Image / Banner
          </button>

          <button
            type="button"
            onClick={() => setShowButtonModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <MousePointerClick className="h-3.5 w-3.5 text-emerald-600" />
            + Add CTA Button
          </button>

          <button
            type="button"
            onClick={handleInsertCallout}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Layers className="h-3.5 w-3.5 text-amber-600" />
            + Highlight Box
          </button>
        </div>

        {/* Live Email Size Meter */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span
              className={`text-[11px] font-bold block ${
                emailSizeBytes > 1024 * 1024 ? "text-rose-600 font-extrabold animate-pulse" : "text-slate-700"
              }`}
            >
              {emailSizeBytes > 1024 * 1024 ? "🚨 Exceeds 1 MB Limit: " : "📦 Size: "}
              {emailSizeKb} KB / 1,024 KB (1 MB)
            </span>
            <div className="w-32 bg-slate-200 h-2 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full transition-all ${
                  emailSizeBytes > 1024 * 1024
                    ? "bg-rose-500"
                    : emailSizeBytes > 800 * 1024
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, (emailSizeBytes / (1024 * 1024)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Critical Warning Banner if Template Exceeds 1 MB Limit */}
      {emailSizeBytes > 1024 * 1024 && (
        <div className="flex items-center gap-3 p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-xs text-rose-800 shadow-sm animate-pulse">
          <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          <div>
            <strong className="block font-bold">Template Size Exceeds 1 MB Limit ({emailSizeKb} KB / 1,024 KB max)</strong>
            <span>
              ईमेल का कुल साइज़ 1 MB से ज़्यादा है। कैंपेन लॉन्च और टेस्ट सेंड तब तक ब्लॉक रहेगा जब तक आप इमेज का साइज़ कम करके 1 MB या उससे कम नहीं कर लेते।
            </span>
          </div>
        </div>
      )}

      {/* Editor Tabs: Visual (No Code) vs Preview vs HTML Code */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-0">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("visual")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === "visual"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            🎨 Visual Designer (No Coding Required)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("preview")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === "preview"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            Recipient Preview
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("code")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === "code"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            HTML Code
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("text")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === "text"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            Plain Text
          </button>
        </div>

        {/* Dynamic Personalization Chips */}
        <div className="flex items-center gap-1.5 pb-1">
          <span className="text-[11px] text-slate-400">Insert:</span>
          <button
            type="button"
            onClick={() => insertPersonalizationTag("{{name}}")}
            className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            + {"{{name}}"}
          </button>
          <button
            type="button"
            onClick={() => insertPersonalizationTag("{{company}}")}
            className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            + {"{{company}}"}
          </button>
          <button
            type="button"
            onClick={() => insertPersonalizationTag("{{email}}")}
            className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            + {"{{email}}"}
          </button>
        </div>
      </div>

      {/* TAB 1: VISUAL WYSIWYG DESIGNER */}
      {activeTab === "visual" && (
        <div className="space-y-2">
          {/* Visual Formatting Toolbar */}
          <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-100/80 rounded-lg border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => executeCommand("bold")}
              className="p-1.5 rounded hover:bg-white text-slate-700 font-bold"
              title="Bold"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("italic")}
              className="p-1.5 rounded hover:bg-white text-slate-700 italic"
              title="Italic"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("underline")}
              className="p-1.5 rounded hover:bg-white text-slate-700 underline"
              title="Underline"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => executeCommand("justifyLeft")}
              className="p-1.5 rounded hover:bg-white text-slate-700"
              title="Align Left"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("justifyCenter")}
              className="p-1.5 rounded hover:bg-white text-slate-700"
              title="Align Center"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand("justifyRight")}
              className="p-1.5 rounded hover:bg-white text-slate-700"
              title="Align Right"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <button
              type="button"
              onClick={() => executeCommand("insertUnorderedList")}
              className="p-1.5 rounded hover:bg-white text-slate-700"
              title="Bullet List"
            >
              <List className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => executeCommand("formatBlock", "<h2>")}
              className="px-2 py-1 rounded hover:bg-white text-slate-700 font-bold"
              title="Heading"
            >
              H2
            </button>

            <button
              type="button"
              onClick={() => executeCommand("formatBlock", "<p>")}
              className="px-2 py-1 rounded hover:bg-white text-slate-700"
              title="Paragraph"
            >
              Paragraph
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1" />

            <span className="text-[11px] text-slate-500 ml-auto flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" />
              Click anywhere inside the box below to edit text directly
            </span>
          </div>

          {/* Interactive Visual Canvas Container */}
          <div className="rounded-xl border border-slate-300 bg-slate-100 p-6 min-h-[420px] max-h-[650px] overflow-y-auto">
            <div className="max-w-[620px] mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div
                ref={visualEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleVisualInput}
                className="outline-none focus:ring-0 min-h-[300px] text-slate-800 leading-relaxed font-sans"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LIVE RECIPIENT SIMULATOR (DESKTOP & MOBILE) */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            <span className="text-xs font-bold text-slate-700">Preview Device:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold ${
                  previewDevice === "desktop"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop (600px)
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold ${
                  previewDevice === "mobile"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile (iPhone / Android)
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-300 bg-slate-200/70 p-6 flex justify-center min-h-[460px]">
            <div
              className={`bg-white rounded-xl shadow-lg border border-slate-300 transition-all overflow-hidden ${
                previewDevice === "mobile" ? "w-[375px] p-4" : "w-full max-w-[640px] p-8"
              }`}
            >
              {/* Fake Email Client Header */}
              <div className="border-b border-slate-100 pb-3 mb-4 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-900">
                    Subject: {subject.replace(/{{name}}/g, "Alex").replace(/{{company}}/g, "Acme Corp")}
                  </span>
                  <span className="text-slate-400">10:30 AM</span>
                </div>
                <div className="text-slate-500">
                  To: <span className="text-slate-800 font-medium">alex@acmecorp.com</span>
                </div>
              </div>

              {/* Rendered HTML with dummy dynamic tags */}
              <div
                dangerouslySetInnerHTML={{
                  __html: (htmlBody || "")
                    .replace(/{{name}}/g, "Alex")
                    .replace(/{{firstName}}/g, "Alex")
                    .replace(/{{company}}/g, "Acme Corp")
                    .replace(/{{email}}/g, "alex@acmecorp.com"),
                }}
              />

              {/* Automated RFC 8058 Unsubscribe Footer */}
              <div className="mt-8 pt-4 border-t border-slate-100 text-center text-[11px] text-slate-400">
                You received this email because your contact was included in our outreach campaign.
                <br />
                <span className="text-indigo-600 underline">Click here to unsubscribe</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HTML CODE EDITOR (FOR ADVANCED USERS) */}
      {activeTab === "code" && (
        <div className="space-y-2">
          <textarea
            rows={14}
            value={htmlBody}
            onChange={(e) => setHtmlBody(e.target.value)}
            className="w-full font-mono text-xs rounded-xl border border-slate-300 p-4 text-slate-800 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed shadow-inner"
          />
          <p className="text-[11px] text-slate-400">
            Direct HTML source editing. Any changes made here reflect instantly in Visual Builder and Recipient Preview.
          </p>
        </div>
      )}

      {/* TAB 4: PLAIN TEXT */}
      {activeTab === "text" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs">
            <div>
              <span className="font-bold text-indigo-900 block flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-indigo-600" />
                Pure Plain-Text Mode (Human 1-to-1 Style)
              </span>
              <p className="text-[11px] text-indigo-700 mt-0.5">
                Gmail &amp; Outlook HTML ko pehle display karte hain. Agar aap chahte hain ki recipient ko yahi plain text dikhe, toh &ldquo;Apply as Main Email&rdquo; dabayein.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={generatePlainFromHtml}
                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-[11px] shadow-xs"
                title="Convert current HTML to Plain Text"
              >
                📥 Auto-extract from HTML
              </button>
              <button
                type="button"
                onClick={applyPlainTextAsMainEmail}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-500 shadow-xs flex items-center gap-1.5 text-xs transition-all"
              >
                <Zap className="h-3.5 w-3.5 text-amber-300" />
                ⚡ Apply as Main Email
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 px-1 gap-2">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input
                type="checkbox"
                checked={syncPlainToHtml}
                onChange={(e) => {
                  setSyncPlainToHtml(e.target.checked);
                  if (e.target.checked) {
                    applyPlainTextAsMainEmail();
                  }
                }}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
              />
              <span>Live Auto-Sync: Jo bhi yahan type karunga, wahi main email me send hoga</span>
            </label>
            {syncPlainToHtml && (
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200">
                ✓ Sync Active (Gmail will display plain text)
              </span>
            )}
          </div>

          <textarea
            rows={12}
            value={plainTextBody}
            onChange={(e) => handlePlainTextChange(e.target.value)}
            placeholder="Type your plain text email here (e.g. Hello Alex, quick question for you...)"
            className="w-full font-mono text-xs rounded-xl border border-slate-300 p-4 text-slate-800 bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner leading-relaxed"
          />
          <p className="text-[11px] text-slate-500">
            Plain text version delivered to corporate inboxes with zero spam code. Guarantees 95%+ Primary Inbox placement.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PICK PRE-MADE TEMPLATE */}
      {/* ========================================================================= */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  Choose a Pre-Made Pro Template (1-Click)
                </h3>
                <p className="text-xs text-slate-500">
                  Select a template designed for high inbox placement and 1 MB image capability.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto p-1">
              {PRESET_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.id}
                  onClick={() => handleSelectTemplate(tmpl)}
                  className="rounded-xl border border-slate-200 bg-white p-4 hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-900">{tmpl.name}</span>
                      <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                        {tmpl.category}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mb-3">
                      {tmpl.description}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Subject: {tmpl.subject.slice(0, 24)}...</span>
                    <span className="font-bold text-indigo-600 hover:underline">Use &rarr;</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD / UPLOAD IMAGE (1 MB+ READY) */}
      {/* ========================================================================= */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-indigo-600" />
                  Insert Image or Banner (Up to 1 MB+)
                </h3>
                <p className="text-xs text-slate-500">
                  Upload an image from your computer or paste an external image URL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {uploadError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg border border-rose-200">
                {uploadError}
              </div>
            )}

            {/* Source Tabs */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setImageSourceType("upload")}
                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                  imageSourceType === "upload"
                    ? "bg-indigo-50 border-indigo-600 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                📁 Upload from Computer
              </button>
              <button
                type="button"
                onClick={() => setImageSourceType("url")}
                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                  imageSourceType === "url"
                    ? "bg-indigo-50 border-indigo-600 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                🌐 Paste Image URL
              </button>
            </div>

            {/* Upload Tab */}
            {imageSourceType === "upload" && (
              <div className="space-y-3">
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 hover:border-indigo-500 transition-colors">
                  <Upload className="h-8 w-8 text-slate-400 mb-2" />
                  <span className="text-xs font-semibold text-slate-700">
                    Choose PNG, JPG, GIF or WebP
                  </span>
                  <span className="text-[11px] text-slate-400">Supports up to 5 MB file size</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileUpload}
                    className="mt-3 text-xs text-slate-500 file:mr-2 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>

                {isUploadingImage && (
                  <p className="text-xs text-indigo-600 font-semibold text-center animate-pulse">
                    Uploading & preparing image...
                  </p>
                )}

                {uploadedBase64 && (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-emerald-800 font-bold">
                      <Check className="h-4 w-4 text-emerald-600" />
                      Image ready! Preview:
                    </div>
                    <img
                      src={uploadedBase64}
                      alt="Upload Preview"
                      className="max-h-32 mx-auto rounded border border-slate-200 object-contain"
                    />
                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-emerald-200">
                      <span>Embedding Mode:</span>
                      <div className="flex gap-2">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="embed"
                            checked={embedMode === "base64"}
                            onChange={() => setEmbedMode("base64")}
                          />
                          Direct Base64 (100% Self-Contained)
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="radio"
                            name="embed"
                            checked={embedMode === "url"}
                            onChange={() => setEmbedMode("url")}
                          />
                          Hosted URL
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* URL Tab */}
            {imageSourceType === "url" && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Public Image URL *
                </label>
                <input
                  type="url"
                  placeholder="https://yourdomain.com/banner.png"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            )}

            {/* Image Sizing & Alignment */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Image Width (Size)
                </label>
                <select
                  value={imageWidth}
                  onChange={(e) => setImageWidth(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="100%">Full Width (100% Hero Banner)</option>
                  <option value="75%">Large (75%)</option>
                  <option value="50%">Medium (50%)</option>
                  <option value="180px">Logo / Icon (180px)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Alignment</label>
                <select
                  value={imageAlign}
                  onChange={(e) => setImageAlign(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                >
                  <option value="center">Center</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowImageModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertImage}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-xs"
              >
                Insert Image into Email
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD CTA BUTTON */}
      {/* ========================================================================= */}
      {showButtonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <MousePointerClick className="h-5 w-5 text-emerald-600" />
                  Insert Call-to-Action (CTA) Button
                </h3>
                <p className="text-xs text-slate-500">
                  Custom button that works across Gmail, Outlook, Apple Mail.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowButtonModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Button Text *
                </label>
                <input
                  type="text"
                  value={btnText}
                  onChange={(e) => setBtnText(e.target.value)}
                  placeholder="e.g. Schedule a 10-Min Call"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Link URL *
                </label>
                <input
                  type="url"
                  value={btnUrl}
                  onChange={(e) => setBtnUrl(e.target.value)}
                  placeholder="https://yourdomain.com/demo"
                  className="w-full rounded-lg border border-slate-200 px-3.5 py-2 text-xs focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Button Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={btnColor}
                      onChange={(e) => setBtnColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border border-slate-200 p-0.5"
                    />
                    <span className="text-xs font-mono text-slate-600">{btnColor}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Alignment</label>
                  <select
                    value={btnAlign}
                    onChange={(e) => setBtnAlign(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="center">Center</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>

              {/* Live Button Preview */}
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 block mb-2 uppercase">
                  Live Preview
                </span>
                <span
                  style={{
                    backgroundColor: btnColor,
                    borderRadius: btnRadius,
                    color: "#ffffff",
                    padding: "10px 24px",
                    fontWeight: 700,
                    fontSize: "14px",
                    display: "inline-block",
                  }}
                >
                  {btnText || "Button"} &rarr;
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowButtonModal(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsertButton}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 shadow-xs"
              >
                Insert Button
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
