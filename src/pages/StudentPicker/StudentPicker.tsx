import React, { useEffect, useState } from 'react';
import './StudentPicker.scss';

function parseTextToNames(text: string): string[] {
    const raw = text
        .split(/[\r\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);

    const seen = new Set<string>();
    const out: string[] = [];
    for (const n of raw) {
        const k = n.toLowerCase();
        if (!seen.has(k)) {
            seen.add(k);
            out.push(n);
        }
    }
    return out;
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

function parseCsvToNames(csv: string, colIdx: number | null = null, dropHeader = true): string[] {
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

    const out: string[] = [];
    for (let i = start; i < lines.length; i++) {
        const cells = splitCsvLine(lines[i]);
        if (useCol < cells.length) {
            const v = cells[useCol].trim();
            if (v) out.push(v);
        }
    }

    return parseTextToNames(out.join('\n'));
}

export default function StudentPicker() {
    const [studentText, setStudentText] = useState('Alice,Bob,Charlie');

    const [studentList, setStudentList] = useState<string[]>([]);
    const [pickedStudent, setPickedStudent] = useState('');

    const [spFileMsg, setSpFileMsg] = useState('');
    const [spCsvDropHeader, setSpCsvDropHeader] = useState(true);
    const [spCsvColumn, setSpCsvColumn] = useState('');

    const [spLastFileText, setSpLastFileText] = useState('');
    const [spLastIsCsv, setSpLastIsCsv] = useState(false);

    const [pickCount, setPickCount] = useState('1');

    useEffect(() => {
        if (!spLastFileText) return;
        try {
            let names: string[] = [];
            if (spLastIsCsv) {
                const col = spCsvColumn.trim() === '' ? null : Number(spCsvColumn);
                if (col !== null && Number.isNaN(col)) return;
                names = parseCsvToNames(spLastFileText, col, spCsvDropHeader);
            } else {
                names = parseTextToNames(spLastFileText);
            }
            if (names.length) {
                setStudentText(names.join('\n'));
                setStudentList(names);
                setPickedStudent('');
            }
        } catch {}
    }, [spCsvDropHeader, spCsvColumn, spLastFileText, spLastIsCsv]);

    function handlePick() {
        let pool = studentList.length ? [...studentList] : parseTextToNames(studentText);

        if (!pool.length) {
            setPickedStudent('');
            setStudentList([]);
            return;
        }

        const rawCount = Number(pickCount);
        let n = Number.isNaN(rawCount) || rawCount <= 0 ? 1 : Math.floor(rawCount);
        if (n > pool.length) n = pool.length;

        const chosen: string[] = [];
        for (let i = 0; i < n; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            chosen.push(pool[idx]);
            pool.splice(idx, 1);
        }

        setPickedStudent(chosen.join(', '));
        setStudentList(pool);
    }

    const remainingStudents = studentList.length > 0 ? studentList : parseTextToNames(studentText);

    const canPick = remainingStudents.length > 0;

    return (
        <div className="container py-2 sp-wrap">
            <h2 className="sp-heading">Random Student Picker</h2>


            <div className="mb-3">
                <label className="form-label">(Optional)Load Students from File (.txt or .csv)</label>
                <input
                    type="file"
                    accept=".txt,.csv,text/plain,text/csv"
                    className="form-control"
                    onChange={async (e) => {
                        setSpFileMsg('');
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (!file) return;

                        if (file.size > 2 * 1024 * 1024) {
                            setSpFileMsg('File too large (max 2MB).');
                            return;
                        }

                        try {
                            const text = await file.text();
                            const isCsv = /\.csv$/i.test(file.name) || file.type.includes('csv');

                            let names: string[] = [];
                            if (isCsv) {
                                const col = spCsvColumn.trim() === '' ? null : Number(spCsvColumn);
                                if (col !== null && Number.isNaN(col)) {
                                    setSpFileMsg('Column index must be a number if provided.');
                                    return;
                                }
                                names = parseCsvToNames(text, col, spCsvDropHeader);
                            } else {
                                names = parseTextToNames(text);
                            }

                            if (!names.length) {
                                setSpFileMsg('No names found in the file.');
                                return;
                            }

                            setSpLastFileText(text);
                            setSpLastIsCsv(isCsv);

                            setStudentText(names.join('\n'));
                            setStudentList(names);
                            setPickedStudent('');
                            setSpFileMsg(`Loaded ${names.length} students from ${file.name}`);
                        } catch {
                            setSpFileMsg('Failed to read or parse the file.');
                        }
                    }}
                />

                <div className="d-flex gap-3 mt-2 align-items-center">
                    <div className="form-check">
                        <input
                            id="spCsvHeader"
                            className="form-check-input"
                            type="checkbox"
                            checked={spCsvDropHeader}
                            onChange={(e) => setSpCsvDropHeader(e.target.checked)}
                        />
                        <label htmlFor="spCsvHeader" className="form-check-label">
                            CSV has header
                        </label>
                    </div>

                    <div className="d-flex align-items-center">
                        <label htmlFor="spCsvCol" className="form-label me-2 mb-0">
                            Column
                        </label>
                        <input
                            id="spCsvCol"
                            type="number"
                            min={0}
                            className="form-control"
                            style={{ width: 90 }}
                            placeholder="auto"
                            value={spCsvColumn}
                            onChange={(e) => setSpCsvColumn(e.target.value)}
                        />
                    </div>
                </div>

                {spFileMsg && <div className="alert alert-warning mt-2 py-2">{spFileMsg}</div>}
            </div>

            <label htmlFor="studentText" className="form-label">
                Names (comma or newline)
            </label>
            <textarea
                id="studentText"
                className="form-control mb-3"
                rows={5}
                value={studentText}
                onChange={(e) => {
                    setStudentText(e.target.value);
                    setStudentList([]);
                    setPickedStudent('');
                }}
            />

            <div className="d-flex gap-2 align-items-center flex-wrap mb-2">
                <label htmlFor="pickCount" className="form-label mb-0">
                    Number to pick
                </label>
                <input
                    id="pickCount"
                    type="number"
                    min={1}
                    className="form-control"
                    style={{ width: 100 }}
                    value={pickCount}
                    onChange={(e) => setPickCount(e.target.value)}
                />
            </div>

            <div className="d-flex gap-2 mt-2 flex-wrap">
                <button className="btn btn-success" onClick={handlePick} disabled={!canPick}>
                    Pick
                </button>

                <button
                    className="btn btn-outline-secondary"
                    onClick={() => {
                        setStudentList([]);
                        setStudentText('');
                        setPickedStudent('');
                    }}
                >
                    Clear List
                </button>

                <button
                    className="btn btn-outline-info"
                    onClick={() => {
                        if (!remainingStudents.length) return;
                        navigator.clipboard.writeText(remainingStudents.join('\n'));
                    }}
                    disabled={!remainingStudents.length}
                >
                    Copy Remaining
                </button>
            </div>

            {pickedStudent && (
                <p className="alert alert-info mt-3">
                    Picked: <b>{pickedStudent}</b>
                </p>
            )}

            {remainingStudents.length > 0 && (
                <div className="mt-3">
                    <h5 className="h6">Remaining Students:</h5>
                    <ul className="mb-0">
                        {remainingStudents.map((name, idx) => (
                            <li key={idx}>{name}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

export {};
