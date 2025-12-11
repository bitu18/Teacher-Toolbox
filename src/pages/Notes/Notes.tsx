import React, { useEffect, useMemo, useState, useCallback } from "react";
import { db, ensureAnon } from "../../firebase/firebaseConfig";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import "./Notes.scss";

type NoteDoc = {
  id: string;
  title: string;
  body: string;
  ownerId?: string | null;
  createdAt?: any;
  updatedAt?: any;
};

function formatTs(ts: any | undefined) {
  try {
    if (ts?.toDate) {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(ts.toDate());
    }
    if (typeof ts === "number") {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(ts));
    }
  } catch {}
  return "Unknown";
}

function formatError(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const maybe = err as { code?: unknown; message?: unknown };
    const code = typeof maybe.code === "string" ? `${maybe.code}: ` : "";
    const msg = typeof maybe.message === "string" ? maybe.message : fallback;
    return code + msg;
  }
  return fallback;
}

export default function Note() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const [notes, setNotes] = useState<NoteDoc[]>([]);
  const [selected, setSelected] = useState<NoteDoc | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");

  const [uploadError, setUploadError] = useState<string | null>(null);

  const notesCol = useMemo(() => collection(db, "teacherNotes"), []);

  const canSave = (!!title.trim() || !!body.trim()) && !saving;

  useEffect(() => {
    let unsub: (() => void) | null = null;
    let cancelled = false;

    async function startListener() {
      try {
        const uid = await ensureAnon();
        if (cancelled) return;

        const q = query(
          notesCol,
          where("ownerId", "==", uid),
          orderBy("createdAt", "desc")
        );

        unsub = onSnapshot(
          q,
          (qs) => {
            const list: NoteDoc[] = qs.docs.map((d) => {
              const note: any = d.data();
              return {
                id: d.id,
                title: note.title ?? "",
                body: note.body ?? "",
                ownerId: note.ownerId ?? null,
                createdAt: note.createdAt,
                updatedAt: note.updatedAt,
              };
            });
            setNotes(list);
            setSelected((prev) => {
              if (!prev) return prev;
              const refreshed = list.find((n) => n.id === prev.id);
              return refreshed ?? prev;
            });
          },
          (err) => {
            const errorMessage = formatError(
              err,
              "Failed to load notes from Firestore"
            );
            setUploadError(errorMessage);
            alert(errorMessage);
          }
        );
      } catch (e: any) {
        const errorMessage = formatError(
          e,
          "Failed to initialize notes listener"
        );
        setUploadError(errorMessage);
        alert(errorMessage);
      }
    }

    startListener();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [notesCol]);

  const handleSave = useCallback(
    async () => {
      if (!title.trim() && !body.trim()) {
        alert("Please add a title or note.");
        return;
      }

      setSaving(true);
      setUploadError(null);

      try {
        const uid = await ensureAnon();

        const noteId = crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
        const payload: Record<string, any> = {
          title: title.trim() || "",
          body: body.trim() || "",
          ownerId: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, "teacherNotes", noteId), payload);

        setTitle("");
        setBody("");
        setUploadError(null);
      } catch (e: any) {
        const errorMessage = formatError(e, "Failed to save note");
        setUploadError(errorMessage);
        alert(errorMessage);
      } finally {
        setSaving(false);
      }
    },
    [title, body]
  );

  async function handleDelete(note: NoteDoc) {
    const ok = window.confirm(`Delete "${note.title || "(untitled)"}"?`);
    if (!ok) return;

    try {
      await ensureAnon();
      await deleteDoc(doc(db, "teacherNotes", note.id));
      if (selected?.id === note.id) setSelected(null);
    } catch (e: any) {
      const errorMessage = formatError(e, "Failed to delete note");
      alert(errorMessage);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (canSave) handleSave();
      }
      if (e.key === "Escape") {
        setSelected(null);
        setIsEditing(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSave, handleSave]);

  function openNote(n: NoteDoc) {
    setSelected(n);
    setIsEditing(false);
    setEditTitle(n.title || "");
    setEditBody(n.body || "");
  }

  function closeNote() {
    setSelected(null);
    setIsEditing(false);
  }

  const editChanged =
    (selected?.title || "") !== editTitle ||
    (selected?.body || "") !== editBody;

  async function saveEdit() {
    if (!selected) return;
    try {
      await ensureAnon();

      const updatePayload = {
        title: editTitle.trim(),
        body: editBody.trim(),
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "teacherNotes", selected.id), updatePayload);
      setSelected((prev) =>
        prev ? { ...prev, title: editTitle.trim(), body: editBody.trim() } : prev
      );
      setIsEditing(false);
    } catch (e: any) {
      const errorMessage = formatError(e, "Failed to update note");
      alert(errorMessage);
    }
  }

  return (
    <div className="note-container">
      <h2 className="note-page-title">Teacher Notes</h2>

      <div className="note-grid">
        <div className="card note-card-editor">
          <div className="field">
            <label className="label">Title</label>
            <input
              type="text"
              className="input"
              placeholder="e.g., Parent meeting agenda"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Note</label>
            <textarea
              className="textarea"
              placeholder="Write your note…"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {uploadError && (
            <div className="error-message">⚠ {uploadError}</div>
          )}

          <div className="actions">
           <button
  className="btn btn-save"
  onClick={handleSave}
  disabled={!canSave}
>
  {saving ? "Saving…" : "Save Note"}
</button>

<button
  className="btn btn-clear-red"
  onClick={() => {
    setTitle("");
    setBody("");
    setUploadError(null);
  }}
  disabled={saving}
>
  Clear
</button>

          </div>
        </div>

        <div className="card note-card-list">
          <div className="list-header">
            <h3 className="list-title">Saved Notes</h3>
            <div className="list-tools">
              <span className="list-badge">{notes.length} total</span>
            </div>
          </div>

          {notes.length === 0 ? (
            <div className="note-empty">
              No notes yet — create your first note on the left.
            </div>
          ) : (
            <div className="note-list">
              {notes.map((n) => (
                <div key={n.id} className="note-item">
                  <div className="note-item-main" onClick={() => openNote(n)}>
                    <div className="note-item-title">
                      {n.title || "(untitled)"}
                    </div>
                    {n.body && (
                      <div className="note-item-body">{n.body}</div>
                    )}
                    <div className="note-item-meta">
                      <small>
                        Created: {formatTs(n.createdAt)}
                        {n.updatedAt && <> • Updated: {formatTs(n.updatedAt)}</>}
                      </small>
                    </div>
                  </div>

                  <div className="note-item-actions">

                    
                    <button className="btn btn-open" onClick={() => openNote(n)}>
  Open
</button>

<button className="btn btn-delete" onClick={() => handleDelete(n)}>
  Delete
</button>


                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <div className="note-modal-backdrop" onClick={closeNote}>
          <div className="note-modal" onClick={(e) => e.stopPropagation()}>
            <div className="note-modal-header">
              {isEditing ? (
                <input
                  className="input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              ) : (
                <h3 className="note-modal-title">
                  {selected.title || "(untitled)"}
                </h3>
              )}

              <div className="note-modal-actions">
                {!isEditing ? (
                  <button
                    className="btn btn-blue"
                    onClick={() => setIsEditing(true)}
                  >
                    Edit
                  </button>
                ) : (
                  <>
                    <button
                      className="btn btn-blue"
                      onClick={saveEdit}
                      disabled={!editChanged}
                    >
                      Save
                    </button>
                    <button
                      className="btn btn-blue"
                      onClick={() => {
                        setIsEditing(false);
                        setEditTitle(selected.title || "");
                        setEditBody(selected.body || "");
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
                <button className="btn btn-blue" onClick={closeNote}>
                  Close
                </button>
              </div>
            </div>

            <div className="note-modal-body">
              {isEditing ? (
                <textarea
                  className="textarea"
                  rows={8}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{selected.body}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
