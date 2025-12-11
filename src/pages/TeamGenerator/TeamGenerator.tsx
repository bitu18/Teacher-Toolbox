import React, { useEffect, useMemo, useRef, useState } from 'react';
import './TeamGenerator.scss';
import { db, ensureAnon } from '../../firebase/firebaseConfig';
import {
    collection,
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
} from 'firebase/firestore';

type Team = string[];
type Teams = Team[];

type Snapshot = {
    inputNames: string;
    teamSizeStr: string;
    teams: { members: string[] }[];
    updatedAt?: unknown;
};

type TeamRunDoc = {
    id: string;
    inputNames: string;
    teamSizeStr: string;
    teams: { members: string[] }[];
    createdAt?: any;
};

function parseTextToNames(text: string): string[] {
    return text
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function splitCsvLine(line: string): string[] {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            cells.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    cells.push(cur.trim());
    return cells;
}

function parseCsvToNames(csv: string, colIdx: number | null, dropHeader: boolean): string[] {
    const lines = csv
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    if (!lines.length) return [];
    let useCol = colIdx ?? -1;
    const start = dropHeader ? 1 : 0;
    if (useCol < 0) {
        const probe = splitCsvLine(lines[0]);
        useCol = Math.max(
            probe.findIndex((c) => /[a-z]/i.test(c) && /\s/.test(c)),
            probe.findIndex((c) => /[a-z]/i.test(c)),
        );
        if (useCol < 0) useCol = 0;
    }
    const raw: string[] = [];
    for (let i = start; i < lines.length; i++) {
        const cells = splitCsvLine(lines[i]);
        if (useCol < cells.length) {
            const v = cells[useCol].trim();
            if (v) raw.push(v);
        }
    }
    return parseTextToNames(raw.join('\n'));
}

function secureSeed(): string {
    try {
        const a = new Uint32Array(2);
        crypto.getRandomValues(a);
        return `${Date.now()}:${a[0]}:${a[1]}`;
    } catch {
        return `${Date.now()}:${Math.random()}`;
    }
}

function makeRng(seedStr: string) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seedStr.length; i++) {
        h ^= seedStr.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    let x = h || 123456789;
    return () => {
        x ^= x << 13;
        x ^= x >>> 17;
        x ^= x << 5;
        return (x >>> 0) / 4294967296;
    };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
    const input = Array.isArray(arr) ? arr : [];
    const len = input.length >>> 0;
    if (!Number.isFinite(len)) return [];
    const a = [...input];
    for (let i = len - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function dealIntoTeams(names: string[], size: number): string[][] {
    const sz = Number.isFinite(size) && size > 0 ? Math.floor(size) : 1;
    const teamCountRaw = Math.ceil(names.length / sz);
    const teamCount = Math.min(Math.max(1, teamCountRaw), 10000);
    const teams = Array.from({ length: teamCount }, () => [] as string[]);
    let t = 0;
    for (const n of names) {
        teams[t].push(n);
        t = (t + 1) % teamCount;
    }
    return teams;
}

function useDebouncedCallback<T extends (...args: any[]) => void>(fn: T, delayMs: number) {
    const timer = useRef<number | undefined>(undefined);
    return (...args: Parameters<T>) => {
        if (timer.current) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => fn(...args), delayMs);
    };
}

export default function TeamGenerator() {
    const ringColors = ['primary', 'success', 'warning', 'info', 'secondary', 'danger'];
    const [uid, setUid] = useState<string | null>(null);
    const [inputNames, setInputNames] = useState('');
    const [teamSizeStr, setTeamSizeStr] = useState('2');
    const [message, setMessage] = useState('');
    const [madeTeams, setMadeTeams] = useState<Teams>([]);
    const [csvDropHeader, setCsvDropHeader] = useState(true);
    const [csvColumn, setCsvColumn] = useState('');
    const [fileMessage, setFileMessage] = useState('');
    const [isDragOver, setIsDragOver] = useState(false);
    const [history, setHistory] = useState<TeamRunDoc[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyError, setHistoryError] = useState<string | null>(null);

    const namesCount = useMemo(() => parseTextToNames(inputNames).length, [inputNames]);
    const teamSizeNum = useMemo(() => {
        const n = parseInt(teamSizeStr, 10);
        return Number.isFinite(n) && n > 0 ? n : 2;
    }, [teamSizeStr]);

    useEffect(() => {
        ensureAnon()
            .then((id) => setUid(id))
            .catch(() => {
                setMessage('Cannot sign in (anonymous).');
            });
    }, []);

    useEffect(() => {
        if (!uid) return;
        const ref = doc(db, 'users', uid, 'teamGenerator', 'latest');
        getDoc(ref)
            .then((snap) => {
                if (snap.exists()) {
                    const d = snap.data() as any;
                    setInputNames(d.inputNames ?? '');
                    setTeamSizeStr(d.teamSizeStr ?? '2');
                    if (Array.isArray(d.teams)) {
                        const restored: Teams = d.teams.map((t: any) =>
                            Array.isArray(t?.members) ? t.members : [],
                        );
                        setMadeTeams(restored);
                    } else if (Array.isArray(d.madeTeams)) {
                        setMadeTeams(d.madeTeams as Teams);
                    }
                }
            })
            .catch(() => {});
    }, [uid]);

    useEffect(() => {
        if (!uid) return;
        setHistoryLoading(true);
        setHistoryError(null);

        const colRef = collection(db, 'users', uid, 'teamGeneratorRuns');
        const q = query(colRef, orderBy('createdAt', 'desc'), limit(10));

        getDocs(q)
            .then((snap) => {
                const items: TeamRunDoc[] = snap.docs.map((d) => {
                    const data = d.data() as any;
                    return {
                        id: d.id,
                        inputNames: data.inputNames ?? '',
                        teamSizeStr: data.teamSizeStr ?? '2',
                        teams: Array.isArray(data.teams)
                            ? data.teams.map((t: any) =>
                                  Array.isArray(t?.members) ? { members: t.members } : { members: [] },
                              )
                            : [],
                        createdAt: data.createdAt,
                    };
                });
                setHistory(items);
            })
            .catch(() => {
                setHistoryError('Could not load saved team sets.');
            })
            .finally(() => setHistoryLoading(false));
    }, [uid, message]);

    async function saveSnapshot(partial?: Partial<Snapshot>) {
        if (!uid) return;
        const ref = doc(db, 'users', uid, 'teamGenerator', 'latest');

        const teamsForFirestore =
            partial && 'teams' in partial && partial.teams !== undefined
                ? partial.teams
                : madeTeams.map((team) => ({ members: team }));

        const payload: Snapshot = {
            inputNames,
            teamSizeStr,
            teams: teamsForFirestore,
            ...partial,
        };

        await setDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    }

    const debouncedSaveNames = useDebouncedCallback((val: string) => {
        saveSnapshot({ inputNames: val }).catch(() => {});
    }, 400);

    const debouncedSaveSize = useDebouncedCallback((val: string) => {
        saveSnapshot({ teamSizeStr: val }).catch(() => {});
    }, 400);

    function makeTeams() {
        setMessage('');
        try {
            const names = parseTextToNames(inputNames);
            if (!names.length) {
                setMessage('Please add or load at least one name.');
                setMadeTeams([]);
                return;
            }
            if (!Number.isFinite(teamSizeNum) || teamSizeNum <= 0) {
                setMessage('Team size must be a positive number.');
                setMadeTeams([]);
                return;
            }
            const rng = makeRng(secureSeed());
            const shuffled = shuffle(names, rng);
            const teams = dealIntoTeams(shuffled, teamSizeNum);
            setMadeTeams(teams);
            setMessage('Teams created at ' + new Date().toLocaleTimeString());
            const teamsForFirestore = teams.map((t) => ({ members: t }));
            saveSnapshot({ teams: teamsForFirestore }).catch(() => {});
        } catch {
            setMessage('Failed to generate teams. Please verify inputs and try again.');
            setMadeTeams([]);
        }
    }

    function clearAll() {
        setInputNames('');
        setTeamSizeStr('2');
        setMadeTeams([]);
        setMessage('Cleared.');
        if (uid) {
            const ref = doc(db, 'users', uid, 'teamGenerator', 'latest');
            deleteDoc(ref).catch(() => {});
        }
    }

    async function saveTeamsToHistory() {
        if (!uid) {
            setMessage('Cannot save yet — still signing in.');
            return;
        }
        if (!madeTeams.length) {
            setMessage('No teams to save.');
            return;
        }
        try {
            const colRef = collection(db, 'users', uid, 'teamGeneratorRuns');
            const teamsForFirestore = madeTeams.map((team) => ({ members: team }));
            await addDoc(colRef, {
                inputNames,
                teamSizeStr,
                teams: teamsForFirestore,
                createdAt: serverTimestamp(),
            });
            setMessage('This team set was saved to Firebase!');
        } catch (e: any) {
            const code = e?.code || 'unknown';
            const msg = e?.message || 'No message';
            setMessage(`Failed to save (code: ${code}). ${msg}`);
        }
    }

    function loadFromHistory(run: TeamRunDoc) {
        setInputNames(run.inputNames);
        setTeamSizeStr(run.teamSizeStr);
        const restored: Teams = run.teams.map((t) => t.members || []);
        setMadeTeams(restored);
        setMessage('Loaded a saved team set.');
    }

    async function deleteHistoryRun(runId: string) {
        if (!uid) return;
        const ok = window.confirm('Delete this saved team set?');
        if (!ok) return;
        try {
            const ref = doc(db, 'users', uid, 'teamGeneratorRuns', runId);
            await deleteDoc(ref);
            setHistory((prev) => prev.filter((r) => r.id !== runId));
            setMessage('Saved team set deleted.');
        } catch {
            setMessage('Failed to delete saved team set.');
        }
    }

    async function handleFileText(text: string, isCsv: boolean) {
        try {
            let names: string[] = [];
            if (isCsv) {
                const col = csvColumn.trim() === '' ? null : Number(csvColumn);
                if (col !== null && Number.isNaN(col)) {
                    setFileMessage('Column index must be numeric if provided.');
                    return;
                }
                names = parseCsvToNames(text, col, csvDropHeader);
            } else {
                names = parseTextToNames(text);
            }
            if (!names.length) {
                setFileMessage('No names detected.');
                return;
            }
            const joined = names.join('\n');
            setInputNames(joined);
            setMessage(`Loaded ${names.length} names.`);
            saveSnapshot({ inputNames: joined }).catch(() => {});
        } catch {
            setFileMessage('Failed to read or parse the file.');
        }
    }

    function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
        setFileMessage('');
        const f = e.target.files?.[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) {
            setFileMessage('File too large (max 2MB).');
            return;
        }
        const isCsv = /\.csv$/i.test(f.name) || f.type.includes('csv');
        f.text().then((t) => handleFileText(t, isCsv));
    }

    function onDrop(e: React.DragEvent<HTMLDivElement>) {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        setFileMessage('');
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        if (f.size > 2 * 1024 * 1024) {
            setFileMessage('File too large (max 2MB).');
            return;
        }
        const isCsv = /\.csv$/i.test(f.name) || f.type.includes('csv');
        f.text().then((t) => handleFileText(t, isCsv));
    }

    return (
        <div className="container py-4">
            <h1 className="tg-heading">Team Generator</h1>

            <div className="tg-wrap">
                <div className="card shadow-sm mb-3">
                    <div className="card-body">
                        <div className="text-center mb-3">
                            <div className="d-flex justify-content-center gap-2 small mt-2">
                                <span className="badge bg-primary-subtle text-primary">
                                    Names: {namesCount}
                                </span>
                                <span className="badge bg-secondary-subtle text-secondary">
                                    Size: {teamSizeNum}
                                </span>
                                <span className="badge bg-info-subtle text-info">
                                    Teams: {madeTeams.length || 0}
                                </span>
                            </div>
                        </div>

                        <div
                            className={`dropzone mb-3 ${isDragOver ? 'drag-over' : ''}`}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setIsDragOver(true);
                            }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={onDrop}
                        >
                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                <input
                                    type="file"
                                    accept=".txt,.csv,text/plain,text/csv"
                                    className="form-control"
                                    onChange={onFilePick}
                                />
                                <div className="form-check ms-1">
                                    <input
                                        id="csvHeader"
                                        className="form-check-input"
                                        type="checkbox"
                                        checked={csvDropHeader}
                                        onChange={(e) => setCsvDropHeader(e.target.checked)}
                                    />
                                    <label htmlFor="csvHeader" className="form-check-label">
                                        CSV has header row
                                    </label>
                                </div>
                                <div className="d-flex align-items-center ms-1">
                                    <label htmlFor="csvCol" className="form-label me-2 mb-0">
                                        Column
                                    </label>
                                    <input
                                        id="csvCol"
                                        type="number"
                                        min={0}
                                        className="form-control"
                                        style={{ width: 90 }}
                                        placeholder="auto"
                                        value={csvColumn}
                                        onChange={(e) => setCsvColumn(e.target.value)}
                                    />
                                </div>
                            </div>
                            {fileMessage && (
                                <div className="alert alert-warning py-2 px-3 mt-2 mb-0 small">
                                    {fileMessage}
                                </div>
                            )}
                        </div>

                        <div className="mb-3">
                            <label htmlFor="names" className="form-label fw-semibold">
                                Names (comma or newline)
                            </label>
                            <textarea
                                id="names"
                                className="form-control"
                                rows={6}
                                placeholder={'Alice\nBob\nCharlie, Dana'}
                                value={inputNames}
                                onChange={(e) => {
                                    setInputNames(e.target.value);
                                    debouncedSaveNames(e.target.value);
                                }}
                            />
                        </div>

                        <div className="mb-2">
                            <label htmlFor="size" className="form-label">
                                Team Size
                            </label>
                            <input
                                id="size"
                                type="number"
                                className="form-control mb-3"
                                min={1}
                                value={teamSizeStr}
                                onChange={(e) => {
                                    setTeamSizeStr(e.target.value);
                                    debouncedSaveSize(e.target.value);
                                }}
                            />

                            <div className="btn-toolbar gap-2 flex-wrap">
                                <button
                                    className="btn btn-primary"
                                    onClick={makeTeams}
                                    disabled={!inputNames.trim()}
                                >
                                    Make Teams
                                </button>

                                <button
                                    className="btn btn-outline-primary"
                                    onClick={() => {
                                        if (!inputNames.trim()) {
                                            setMessage('Add or load names first.');
                                            return;
                                        }
                                        makeTeams();
                                    }}
                                >
                                    Shuffle Again
                                </button>

                                <button className="btn btn-outline-secondary" onClick={clearAll}>
                                    Clear
                                </button>

                                <button
                                    className="btn btn-outline-success"
                                    onClick={() => {
                                        if (!madeTeams.length) {
                                            setMessage('No teams to copy.');
                                            return;
                                        }
                                        const txt = madeTeams
                                            .map((t, i) => `Team ${i + 1}: ${t.join(', ')}`)
                                            .join('\n');
                                        navigator.clipboard.writeText(txt);
                                        setMessage('Teams copied to clipboard!');
                                    }}
                                    disabled={!madeTeams.length}
                                >
                                    Copy Teams
                                </button>

                                <button
                                    className="btn btn-outline-info"
                                    onClick={() => {
                                        if (!madeTeams.length) {
                                            setMessage('No teams to download.');
                                            return;
                                        }
                                        const rows = madeTeams.map(
                                            (t, i) => `Team ${i + 1},${t.join(',')}`,
                                        );
                                        const blob = new Blob([rows.join('\n')], {
                                            type: 'text/csv',
                                        });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = 'teams.csv';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                        setMessage('CSV downloaded!');
                                    }}
                                    disabled={!madeTeams.length}
                                >
                                    Download CSV
                                </button>

                                <button
                                    className="btn btn-outline-warning"
                                    onClick={saveTeamsToHistory}
                                    disabled={!madeTeams.length}
                                >
                                    Save This Team's Data
                                </button>
                            </div>
                        </div>

                        {message && (
                            <div className="alert alert-info py-2 px-3 mt-3 mb-0 small">{message}</div>
                        )}
                    </div>
                </div>

                <div className="card shadow-sm mb-3">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-baseline mb-2">
                            <h3 className="h5 mb-0">Results</h3>
                            <div className="text-muted small">
                                <span className="me-3">
                                    Teams: <strong>{madeTeams.length}</strong>
                                </span>
                                <span>
                                    Members:{' '}
                                    <strong>
                                        {madeTeams.reduce((s, t) => s + t.length, 0)}
                                    </strong>
                                </span>
                            </div>
                        </div>

                        {!madeTeams.length ? (
                            <div className="text-muted">
                                No teams yet — add names and click <em>Make Teams</em>.
                            </div>
                        ) : (
                            <div className="row g-3">
                                {madeTeams.map((team, i) => {
                                    const color = ringColors[i % ringColors.length];
                                    return (
                                        <div className="col-md-6" key={i}>
                                            <div className={`card team-card border-2 border-${color}`}>
                                                <div className="card-body">
                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                        <h4 className="h6 mb-0">Team {i + 1}</h4>
                                                        <span
                                                            className={`badge bg-${color}-subtle text-${color}`}
                                                        >
                                                            {team.length}{' '}
                                                            {team.length === 1
                                                                ? 'member'
                                                                : 'members'}
                                                        </span>
                                                    </div>
                                                    <ul className="mb-0 ps-3">
                                                        {team.map((n, j) => (
                                                            <li key={j}>{n}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="card shadow-sm">
                    <div className="card-body">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <h3 className="h6 mb-0">Saved team sets</h3>
                            <span className="text-muted small">
                                Showing last {history.length} run
                                {history.length === 1 ? '' : 's'}
                            </span>
                        </div>

                        {historyLoading && (
                            <p className="small text-muted mb-0">Loading saved sets…</p>
                        )}

                        {historyError && (
                            <p className="small text-danger mb-0">{historyError}</p>
                        )}

                        {!historyLoading && !historyError && history.length === 0 && (
                            <p className="small text-muted mb-0">
                                No saved sets yet. Use <strong>Save This Set (Firebase)</strong> to
                                store one.
                            </p>
                        )}

                        {!historyLoading && !historyError && history.length > 0 && (
                            <ul className="list-unstyled mb-0 small">
                                {history.map((run) => {
                                    const created =
                                        run.createdAt &&
                                        typeof run.createdAt.toDate === 'function'
                                            ? run.createdAt.toDate()
                                            : null;
                                    const when = created
                                        ? created.toLocaleString()
                                        : 'Unknown time';
                                    const memberCount = run.teams.reduce(
                                        (s, t) => s + (t.members?.length || 0),
                                        0,
                                    );

                                    return (
                                        <li
                                            key={run.id}
                                            className="d-flex justify-content-between align-items-center py-2 border-bottom"
                                        >
                                            <div>
                                                <div>
                                                    <strong>{when}</strong>
                                                </div>
                                                <div className="text-muted">
                                                    {run.teams.length} team
                                                    {run.teams.length === 1 ? '' : 's'} •{' '}
                                                    {memberCount} members • size{' '}
                                                    {run.teamSizeStr}
                                                </div>
                                            </div>
                                            <div className="d-flex gap-2">
                                                <button
                                                    className="btn btn-sm btn-outline-primary"
                                                    onClick={() => loadFromHistory(run)}
                                                >
                                                    Load
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => deleteHistoryRun(run.id)}
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
