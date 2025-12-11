import React, { useEffect, useMemo, useState } from 'react';
import './Calendar.scss';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch,
} from 'firebase/firestore';
import { db, ensureAnon } from '../../firebase/firebaseConfig';

type SlotStatus = 'available' | 'booked' | 'pending';
type ViewMode = 'month' | 'week' | 'day';

interface CalendarEvent {
    id: string;
    title: string;
    start: string;
    end?: string;
    allDay?: boolean;
    color?: string;
    status?: SlotStatus;
    studentName?: string | null;
    ownerId?: string | null;
    createdAt?: any;
}

const COLLECTION = 'calendarEvents';
const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

function ymdLocal(d: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoLocalDate(date: Date) {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const Y = date.getFullYear();
    const M = pad(date.getMonth() + 1);
    const D = pad(date.getDate());
    const h = pad(date.getHours());
    const m = pad(date.getMinutes());
    const s = pad(date.getSeconds());
    return `${Y}-${M}-${D}T${h}:${m}:${s}`;
}

function overlaps(a: CalendarEvent, b: CalendarEvent) {
    const aStart = new Date(a.start).getTime();
    const aEnd = a.end ? new Date(a.end).getTime() : aStart;
    const bStart = new Date(b.start).getTime();
    const bEnd = b.end ? new Date(b.end).getTime() : bStart;
    if (Number.isNaN(aStart) || Number.isNaN(bStart)) return false;
    return aStart < bEnd && bStart < aEnd;
}

function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2);
}

function formatEvent(ev: CalendarEvent) {
    const startDate = new Date(ev.start);
    const endDate = ev.end ? new Date(ev.end) : null;

    const hasValidStart = !Number.isNaN(startDate.getTime());
    const hasValidEnd = endDate && !Number.isNaN(endDate.getTime());

    const dateLabel = hasValidStart
        ? startDate.toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
          })
        : ev.start;

    let timeLabel = ev.allDay ? 'All day' : '—';

    if (!ev.allDay && hasValidStart) {
        const startTime = startDate.toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
        });
        if (hasValidEnd) {
            const endTime = endDate!.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
            });
            timeLabel = `${startTime} – ${endTime}`;
        } else {
            timeLabel = startTime;
        }
    }

    return { dateLabel, timeLabel };
}

function eventDateKey(ev: CalendarEvent): string {
    const s = ev.start?.toString() ?? '';
    return s.slice(0, 10);
}

function isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(d: Date): Date {
    const copy = new Date(d);
    const day = copy.getDay();
    copy.setDate(copy.getDate() - day);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function addDays(d: Date, n: number): Date {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
}

type ModalMode = 'timed' | 'slots';

const Calendar: React.FC = () => {
    const today = new Date();
    const todayStr = ymdLocal(today);

    const [uid, setUid] = useState<string | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [events, setEvents] = useState<CalendarEvent[]>([]);
    const [statusFilter, setStatusFilter] = useState<'all' | SlotStatus>('all');

    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    const [viewMode, setViewMode] = useState<ViewMode>('month');
    const [focusDate, setFocusDate] = useState<Date>(new Date());

    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<ModalMode>('timed');
    const [modalDate, setModalDate] = useState<Date | null>(null);
    const [modalTitle, setModalTitle] = useState('Conference');
    const [modalStart, setModalStart] = useState('14:00');
    const [modalEnd, setModalEnd] = useState('15:00');
    const [modalSlotLength, setModalSlotLength] = useState('15');
    const [modalSlotTitle, setModalSlotTitle] = useState('Conference Slot');

    const eventsRef = useMemo(() => collection(db, COLLECTION), []);
    const eventDoc = (id: string) => doc(db, COLLECTION, id);

    const requireUid = React.useCallback(async (): Promise<string> => {
        try {
            const existing = uid ?? (await ensureAnon());
            if (!existing) {
                throw new Error('Unable to authenticate.');
            }
            if (!uid) setUid(existing);
            setAuthError(null);
            return existing;
        } catch (error: any) {
            console.error('Anonymous auth failed:', error);
            const friendly =
                error?.code === 'auth/operation-not-allowed'
                    ? 'Anonymous sign-in is disabled for this Firebase project. Enable it in the console to use the calendar.'
                    : error?.message || 'Unable to authenticate with Firebase.';
            setAuthError(friendly);
            throw new Error(friendly);
        }
    }, [uid]);

    useEffect(() => {
        let unsub: (() => void) | null = null;
        let cancelled = false;

        requireUid()
            .then((userId) => {
                if (cancelled) return;
                const q = query(eventsRef, where('ownerId', '==', userId));

                unsub = onSnapshot(
                    q,
                    (snap) => {
                        const list: CalendarEvent[] = snap.docs.map((d) => {
                            const data = d.data() as any;
                            return {
                                id: d.id,
                                title: data.title ?? '',
                                start: data.start ?? '',
                                end: data.end ?? undefined,
                                allDay: !!data.allDay,
                                color: data.color ?? '#42a5f5',
                                status: data.status,
                                studentName: data.studentName ?? null,
                                ownerId: data.ownerId ?? null,
                                createdAt: data.createdAt,
                            };
                        });

                        list.sort((a, b) => (a.start || '').localeCompare(b.start || ''));
                        setEvents(list);
                    },
                    (err) => {
                        console.error('Failed to subscribe to calendar events:', err);
                        setAuthError(err?.message || 'Unable to load calendar events.');
                    },
                );
            })
            .catch((err) => {
                console.error('Calendar auth failed:', err);
            });

        return () => {
            cancelled = true;
            if (unsub) unsub();
        };
    }, [eventsRef, requireUid]);

    async function saveEvents(newEvents: CalendarEvent[]) {
        try {
            const ownerId = await requireUid();
            const batch = writeBatch(db);

            newEvents.forEach((ev) => {
                const ref = eventDoc(ev.id);
                batch.set(ref, {
                    ...ev,
                    ownerId,
                    createdAt: serverTimestamp(),
                });
            });

            await batch.commit();
        } catch (e: any) {
            console.error('Failed to save events:', e);

            const msg =
                e?.code === 'permission-denied'
                    ? 'Permission denied when writing calendarEvents. Check Firestore rules.'
                    : e?.message || 'Unknown error saving events.';
            alert(msg);
            throw e;
        }
    }

    async function updateEvent(id: string, patch: Partial<CalendarEvent>) {
        try {
            await requireUid();
            await updateDoc(eventDoc(id), patch as any);
        } catch (e) {
            console.error('Failed to update event:', e);
            throw e;
        }
    }

    async function removeEvent(id: string) {
        try {
            await requireUid();
            await deleteDoc(eventDoc(id));
        } catch (e) {
            console.error('Failed to remove event:', e);
            throw e;
        }
    }

    async function addEventToday() {
        try {
            const title = window.prompt('Enter event title:', 'All-day event');
            if (!title) return;
            const ev: CalendarEvent = {
                id: generateId(),
                title,
                start: todayStr,
                allDay: true,
                color: '#42a5f5',
            };
            await saveEvents([ev]);
            alert(`Event added: "${title}" on ${todayStr}`);
        } catch (e) {
            console.error('Failed to add event:', e);
            alert('Failed to add event. Please try again.');
        }
    }

    function openModal(mode: ModalMode, baseDate?: Date) {
        const d = baseDate ?? new Date();
        setModalMode(mode);
        setModalDate(d);
        setModalTitle('Conference');
        setModalStart('14:00');
        setModalEnd(mode === 'timed' ? '15:00' : '16:00');
        setModalSlotLength('15');
        setModalSlotTitle('Conference Slot');
        setShowModal(true);
    }

    async function handleModalCreateTimed() {
        if (!modalDate) return;

        try {
            const [sh, sm] = modalStart.split(':').map(Number);
            const [eh, em] = modalEnd.split(':').map(Number);

            const baseStr = ymdLocal(modalDate);
            const base = new Date(baseStr + 'T00:00:00');

            const start = new Date(base);
            start.setHours(sh, sm, 0, 0);
            const end = new Date(base);
            end.setHours(eh, em, 0, 0);

            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
                alert('Please choose a valid time range.');
                return;
            }

            const ev: CalendarEvent = {
                id: generateId(),
                title: modalTitle.trim() || 'Conference',
                start: isoLocalDate(start),
                end: isoLocalDate(end),
                allDay: false,
                color: '#42a5f5',
            };

            await saveEvents([ev]);
            setShowModal(false);
        } catch (e) {
            console.error('Failed to create timed event:', e);
            alert('Failed to create event. Please try again.');
        }
    }

    async function handleModalGenerateSlots() {
        if (!modalDate) return;

        try {
            const length = Math.max(5, parseInt(modalSlotLength, 10) || 15);
            const [sh, sm] = modalStart.split(':').map(Number);
            const [eh, em] = modalEnd.split(':').map(Number);

            const baseStr = ymdLocal(modalDate);
            const base = new Date(baseStr + 'T00:00:00');

            const start = new Date(base);
            start.setHours(sh, sm, 0, 0);
            const end = new Date(base);
            end.setHours(eh, em, 0, 0);

            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
                alert('Please choose a valid time range.');
                return;
            }

            const created: CalendarEvent[] = [];
            for (let t = new Date(start); t < end; t = new Date(t.getTime() + length * 60000)) {
                const t2 = new Date(t.getTime() + length * 60000);
                if (t2 > end) break;

                const candidate: CalendarEvent = {
                    id: generateId(),
                    title: modalSlotTitle.trim() || 'Conference Slot',
                    start: isoLocalDate(t),
                    end: isoLocalDate(t2),
                    status: 'available',
                    allDay: false,
                    color: '#43a047',
                };

                const hasConflict = events.some((e) => overlaps(e, candidate));
                if (!hasConflict) created.push(candidate);
            }

            if (!created.length) {
                alert('No slots created (maybe conflicts or too short range).');
                return;
            }

            await saveEvents(created);
            setShowModal(false);
        } catch (e) {
            console.error('Failed to generate slots:', e);
            alert('Failed to generate slots. Please try again.');
        }
    }

    async function handleBook(ev: CalendarEvent) {
        if (ev.status === 'booked') {
            alert('This slot is already booked.');
            return;
        }
        const name = window.prompt('Student name to book this slot?', ev.studentName || '');
        if (!name) return;

        const candidate = { ...ev, studentName: name };
        const conflict = events.some((e) => e.status === 'booked' && e.studentName === name && overlaps(e, candidate));
        if (conflict) {
            alert(`${name} already has a booked slot that overlaps.`);
            return;
        }

        await updateEvent(ev.id, {
            status: 'booked',
            studentName: name,
            color: '#f6c343',
        });
    }

    async function handlePending(ev: CalendarEvent) {
        await updateEvent(ev.id, {
            status: 'pending',
        });
    }

    async function handleClearBooking(ev: CalendarEvent) {
        await updateEvent(ev.id, {
            status: 'available',
            studentName: null,
            color: '#43a047',
        });
    }

    async function handleDelete(ev: CalendarEvent) {
        const ok = typeof window !== 'undefined' ? window.confirm(`Delete "${ev.title}"?`) : false;
        if (!ok) return;
        await removeEvent(ev.id);
    }

    async function clearAllEvents() {
        if (typeof window !== 'undefined' && !window.confirm('Remove every event from the calendar?')) {
            return;
        }
        try {
            await Promise.all(events.map((e) => removeEvent(e.id)));
        } catch (e) {
            console.error('Failed to clear all events:', e);
            alert('Some events could not be deleted. Please try again.');
        }
    }

    async function clearEventsOnDate(day: Date) {
        const key = ymdLocal(day);
        const onThatDay = events.filter((e) => eventDateKey(e) === key);
        if (!onThatDay.length) {
            alert('There are no events on this day.');
            return;
        }

        const label = day.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

        const ok = typeof window !== 'undefined' ? window.confirm(`Remove all events on ${label}?`) : false;
        if (!ok) return;

        try {
            await Promise.all(onThatDay.map((e) => removeEvent(e.id)));
        } catch (e) {
            console.error('Failed to clear events on date:', e);
            alert('Some events could not be deleted. Please try again.');
        }
    }

    const monthDays = useMemo(() => {
        const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
        const startDay = start.getDay();
        start.setDate(start.getDate() - startDay);

        const days: Date[] = [];
        for (let i = 0; i < 42; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            days.push(d);
        }
        return days;
    }, [currentMonth]);

    const yearOptions = useMemo(() => {
        const center = currentMonth.getFullYear();
        const start = center - 5;
        const years: number[] = [];
        for (let y = start; y <= start + 10; y++) {
            years.push(y);
        }
        return years;
    }, [currentMonth]);

    const eventsByDate = useMemo(() => {
        const map: Record<string, CalendarEvent[]> = {};
        for (const ev of events) {
            const key = eventDateKey(ev);
            if (!map[key]) map[key] = [];
            map[key].push(ev);
        }
        return map;
    }, [events]);

    const filteredEvents = useMemo(() => {
        let result = statusFilter === 'all' ? events : events.filter((e) => e.status === statusFilter);

        if (selectedDate) {
            const key = ymdLocal(selectedDate);
            result = result.filter((e) => eventDateKey(e) === key);
        }

        return result;
    }, [events, statusFilter, selectedDate]);

    const availableCount = events.filter((e) => e.status === 'available').length;
    const bookedCount = events.filter((e) => e.status === 'booked').length;
    const pendingCount = events.filter((e) => e.status === 'pending').length;

    const monthLabelBase = viewMode === 'month' ? currentMonth : focusDate;
    const monthLabel = monthLabelBase.toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
    });

    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const selectedDateLabel =
        selectedDate &&
        selectedDate.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

    const modalDateLabel =
        modalDate &&
        modalDate.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });

    const currentMonthIndex = currentMonth.getMonth();
    const currentYear = currentMonth.getFullYear();

    const eventsForDay = (date: Date) => events.filter((ev) => isSameDay(new Date(ev.start), date));

    const dayActions = selectedDate && (
        <div className="cal-day-actions mt-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="small text-muted">
                Selected date:&nbsp;
                <strong>{selectedDateLabel}</strong>
            </div>
            <div className="btn-group btn-group-sm" role="group">
                <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => openModal('timed', selectedDate)}
                >
                    Add timed event on this day
                </button>
                <button
                    type="button"
                    className="btn btn-outline-success"
                    onClick={() => openModal('slots', selectedDate)}
                >
                    Generate slots on this day
                </button>
                <button
                    type="button"
                    className="btn btn-outline-danger"
                    onClick={() => clearEventsOnDate(selectedDate)}
                >
                    Clear events on this day
                </button>
            </div>
        </div>
    );

    const renderWeekView = () => {
        const start = startOfWeek(focusDate);
        const days: Date[] = [];
        for (let i = 0; i < 7; i++) {
            days.push(addDays(start, i));
        }

        return (
            <div className="cal-week-view mt-3">
                <div className="cal-week-grid">
                    {days.map((d) => {
                        const key = ymdLocal(d);
                        const dayEvents = eventsForDay(d);
                        const isToday = key === todayStr;
                        const isSel = selectedDate ? isSameDay(d, selectedDate) : false;

                        let cellClass = 'cal-week-cell';
                        if (isToday) cellClass += ' cal-week-cell--today';
                        if (isSel) cellClass += ' cal-week-cell--selected';

                        return (
                            <div
                                key={key}
                                className={cellClass}
                                onClick={() => {
                                    setSelectedDate(new Date(d));
                                    setFocusDate(new Date(d));
                                }}
                            >
                                <div className="cal-week-date-label">
                                    {d.toLocaleDateString(undefined, {
                                        weekday: 'short',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </div>
                                <div className="cal-week-events">
                                    {dayEvents.length === 0 && (
                                        <div className="cal-week-no-events text-muted small">No events</div>
                                    )}
                                    {dayEvents.map((ev) => {
                                        const { timeLabel } = formatEvent(ev);
                                        let badgeClass = 'badge bg-secondary';
                                        if (ev.status === 'available') badgeClass = 'badge bg-success';
                                        else if (ev.status === 'booked') badgeClass = 'badge bg-warning text-dark';
                                        else if (ev.status === 'pending') badgeClass = 'badge bg-info text-dark';

                                        return (
                                            <div key={ev.id} className="cal-week-event">
                                                <span className={badgeClass} style={{ marginRight: 4 }}>
                                                    {timeLabel}
                                                </span>
                                                <span>{ev.title}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderDayView = () => {
        const day = selectedDate || focusDate;
        const dayEvents = eventsForDay(day);

        return (
            <div className="cal-day-view mt-3">
                <h5 className="mb-3">
                    {day.toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                    })}
                </h5>

                {dayEvents.length === 0 ? (
                    <p className="text-muted small mb-0">No events for this day.</p>
                ) : (
                    <ul className="list-unstyled mb-0">
                        {dayEvents.map((ev) => {
                            const { timeLabel } = formatEvent(ev);
                            let rowClass = 'cal-day-event';
                            if (ev.status === 'available') rowClass += ' cal-day-event--available';
                            else if (ev.status === 'booked') rowClass += ' cal-day-event--booked';
                            else if (ev.status === 'pending') rowClass += ' cal-day-event--pending';

                            return (
                                <li key={ev.id} className={rowClass}>
                                    <div className="cal-day-event-time">{timeLabel}</div>
                                    <div className="cal-day-event-main">
                                        <span className="cal-day-event-title">{ev.title}</span>
                                        {ev.studentName && (
                                            <span className="cal-day-event-student">&nbsp;— {ev.studentName}</span>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        );
    };

    return (
        <div className="cal-wrap">
            {authError && (
                <div className="alert alert-danger mb-3" role="alert">
                    {authError}
                </div>
            )}

            <div className="cal-hero">
                <div className="cal-hero-text">
                    <p className="cal-eyebrow">  </p>
                    <h2 className="cal-heading">Calendar</h2>
                    <p className="cal-subtitle"></p>
                </div>
                <div className="cal-stat-grid">
                    <div className="cal-stat">
                        <span className="cal-stat-label">Total events</span>
                        <span className="cal-stat-value">{events.length}</span>
                    </div>
                    <div className="cal-stat">
                        <span className="cal-stat-label">Available slots</span>
                        <span className="cal-stat-value">{availableCount}</span>
                    </div>
                    <div className="cal-stat">
                        <span className="cal-stat-label">Booked</span>
                        <span className="cal-stat-value">{bookedCount}</span>
                    </div>
                    <div className="cal-stat">
                        <span className="cal-stat-label">Pending</span>
                        <span className="cal-stat-value">{pendingCount}</span>
                    </div>
                </div>
            </div>

            <div className="cal-toolbar">
                <div className="cal-toolbar-group">
                    <label className="cal-filter-label" htmlFor="statusFilter">
                        Filter slots
                    </label>
                    <select
                        id="statusFilter"
                        className="cal-filter form-select form-select-sm"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        aria-label="Filter by status"
                    >
                        <option value="all">All</option>
                        <option value="available">Available</option>
                        <option value="booked">Booked</option>
                        <option value="pending">Pending</option>
                    </select>
                </div>

                <div className="cal-toolbar-actions">
                    <button className="btn btn-outline-danger" onClick={clearAllEvents}>
                        Clear All
                    </button>

                    <button className="btn btn-outline-secondary" onClick={addEventToday}>
                        Add All-day Today
                    </button>

                    <button
                        className="btn btn-outline-primary"
                        onClick={() => openModal('timed', selectedDate ?? new Date())}
                    >
                        Add Timed Event
                    </button>

                    <button className="btn btn-primary" onClick={() => openModal('slots', selectedDate ?? new Date())}>
                        Generate Slots
                    </button>
                </div>
            </div>

            <div className="cal-legend">
                <span className="cal-legend-item">
                    <span className="cal-legend-dot status-available" />
                    Available
                </span>
                <span className="cal-legend-item">
                    <span className="cal-legend-dot status-booked" />
                    Booked
                </span>
                <span className="cal-legend-item">
                    <span className="cal-legend-dot status-pending" />
                    Pending
                </span>
            </div>

            <div className="cal-month card mt-2">
                <div className="cal-month-header card-header d-flex align-items-center justify-content-between">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                            if (viewMode === 'month') {
                                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
                            } else if (viewMode === 'week') {
                                setFocusDate((prev) => {
                                    const d = new Date(prev);
                                    d.setDate(d.getDate() - 7);
                                    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                                    return d;
                                });
                            } else {
                                setFocusDate((prev) => {
                                    const d = new Date(prev);
                                    d.setDate(d.getDate() - 1);
                                    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                                    return d;
                                });
                            }
                        }}
                    >
                        ‹
                    </button>

                    <div className="d-flex align-items-center gap-2">
                        <select
                            className="form-select form-select-sm"
                            value={currentMonthIndex}
                            onChange={(e) => {
                                const m = parseInt(e.target.value, 10);
                                setCurrentMonth((prev) => new Date(prev.getFullYear(), m, 1));
                            }}
                        >
                            {MONTH_NAMES.map((name, idx) => (
                                <option key={name} value={idx}>
                                    {name}
                                </option>
                            ))}
                        </select>

                        <select
                            className="form-select form-select-sm"
                            value={currentYear}
                            onChange={(e) => {
                                const y = parseInt(e.target.value, 10);
                                setCurrentMonth((prev) => new Date(y, prev.getMonth(), 1));
                            }}
                        >
                            {yearOptions.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <div className="btn-group btn-group-sm" role="group">
                            <button
                                type="button"
                                className={viewMode === 'month' ? 'btn btn-primary' : 'btn btn-outline-primary'}
                                onClick={() => setViewMode('month')}
                            >
                                Month
                            </button>
                            <button
                                type="button"
                                className={viewMode === 'week' ? 'btn btn-primary' : 'btn btn-outline-primary'}
                                onClick={() => setViewMode('week')}
                            >
                                Week
                            </button>
                            <button
                                type="button"
                                className={viewMode === 'day' ? 'btn btn-primary' : 'btn btn-outline-primary'}
                                onClick={() => setViewMode('day')}
                            >
                                Day
                            </button>
                        </div>

                        <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => {
                                if (viewMode === 'month') {
                                    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                                } else if (viewMode === 'week') {
                                    setFocusDate((prev) => {
                                        const d = new Date(prev);
                                        d.setDate(d.getDate() + 7);
                                        setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                                        return d;
                                    });
                                } else {
                                    setFocusDate((prev) => {
                                        const d = new Date(prev);
                                        d.setDate(d.getDate() + 1);
                                        setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                                        return d;
                                    });
                                }
                            }}
                        >
                            ›
                        </button>
                    </div>
                </div>

                <div className="cal-month-body card-body">
                    <div className="mb-2 small text-muted text-center">{monthLabel}</div>

                    {viewMode === 'month' && (
                        <>
                            <div className="cal-month-grid">
                                {dayNames.map((d) => (
                                    <div key={d} className="cal-month-dayname">
                                        {d}
                                    </div>
                                ))}

                                {monthDays.map((day) => {
                                    const key = ymdLocal(day);
                                    const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                                    const isToday = key === todayStr;
                                    const isSelected = selectedDate && key === ymdLocal(selectedDate);
                                    const dayEvents = eventsByDate[key] || [];

                                    let cellClass = 'cal-month-cell';
                                    if (!isCurrentMonth) cellClass += ' cal-month-cell--faded';
                                    if (isToday) cellClass += ' cal-month-cell--today';
                                    if (isSelected) cellClass += ' cal-month-cell--selected';

                                    return (
                                        <button
                                            type="button"
                                            key={key + day.getTime()}
                                            className={cellClass}
                                            onClick={() => {
                                                const d = new Date(day);
                                                setSelectedDate(d);
                                                setFocusDate(d);
                                            }}
                                        >
                                            <span className="cal-month-date">{day.getDate()}</span>
                                            {dayEvents.length > 0 && (
                                                <span className="cal-month-dot-indicator">{dayEvents.length}</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {dayActions}
                        </>
                    )}

                    {viewMode === 'week' && (
                        <>
                            {renderWeekView()}
                            {dayActions}
                        </>
                    )}

                    {viewMode === 'day' && (
                        <>
                            {renderDayView()}
                            {dayActions}
                        </>
                    )}
                </div>
            </div>

            <div className="card mt-3">
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-sm table-hover mb-0 align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th style={{ width: '150px' }}>Date</th>
                                    <th style={{ width: '160px' }}>Time</th>
                                    <th>Title</th>
                                    <th style={{ width: '120px' }}>Status</th>
                                    <th style={{ width: '180px' }}>Student</th>
                                    <th style={{ width: '260px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEvents.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-muted text-center py-3">
                                            No events to display. Use the buttons above or click a date to create new
                                            events.
                                        </td>
                                    </tr>
                                )}

                                {filteredEvents.map((ev) => {
                                    const { dateLabel, timeLabel } = formatEvent(ev);
                                    let statusClass = 'badge bg-secondary';
                                    if (ev.status === 'available') statusClass = 'badge bg-success';
                                    else if (ev.status === 'booked') statusClass = 'badge bg-warning text-dark';
                                    else if (ev.status === 'pending') statusClass = 'badge bg-info text-dark';

                                    return (
                                        <tr key={ev.id}>
                                            <td>{dateLabel}</td>
                                            <td>{timeLabel}</td>
                                            <td>{ev.title}</td>
                                            <td>
                                                <span className={statusClass}>
                                                    {ev.status ?? (ev.allDay ? 'all-day' : 'scheduled')}
                                                </span>
                                            </td>
                                            <td>{ev.studentName || <span className="text-muted">—</span>}</td>
                                            <td>
                                                <div className="btn-group btn-group-sm" role="group">
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-success"
                                                        onClick={() => handleBook(ev)}
                                                    >
                                                        Book
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-secondary"
                                                        onClick={() => handlePending(ev)}
                                                    >
                                                        Pending
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-info"
                                                        onClick={() => handleClearBooking(ev)}
                                                    >
                                                        Clear
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn btn-outline-danger"
                                                        onClick={() => handleDelete(ev)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {showModal && (
                <>
                    <div className="modal fade show" style={{ display: 'block' }}>
                        <div className="modal-dialog">
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h5 className="modal-title">
                                        {modalMode === 'timed' ? 'Create Timed Event' : 'Generate Time Slots'}
                                    </h5>
                                    <button type="button" className="btn-close" onClick={() => setShowModal(false)} />
                                </div>
                                <div className="modal-body">
                                    <div className="mb-2 small text-muted">
                                        Date:&nbsp;
                                        <strong>{modalDateLabel}</strong>
                                    </div>

                                    {modalMode === 'timed' && (
                                        <>
                                            <label className="form-label">Event Title</label>
                                            <input
                                                type="text"
                                                className="form-control mb-3"
                                                value={modalTitle}
                                                onChange={(e) => setModalTitle(e.target.value)}
                                                placeholder="Conference, meeting, etc."
                                            />
                                        </>
                                    )}

                                    {modalMode === 'slots' && (
                                        <>
                                            <label className="form-label">Slot Title</label>
                                            <input
                                                type="text"
                                                className="form-control mb-3"
                                                value={modalSlotTitle}
                                                onChange={(e) => setModalSlotTitle(e.target.value)}
                                                placeholder="Parent conference, office hours, etc."
                                            />
                                        </>
                                    )}

                                    <label className="form-label">Start Time</label>
                                    <input
                                        type="time"
                                        className="form-control mb-3"
                                        value={modalStart}
                                        onChange={(e) => setModalStart(e.target.value)}
                                    />

                                    <label className="form-label">End Time</label>
                                    <input
                                        type="time"
                                        className="form-control mb-3"
                                        value={modalEnd}
                                        onChange={(e) => setModalEnd(e.target.value)}
                                    />

                                    {modalMode === 'slots' && (
                                        <>
                                            <label className="form-label">Slot Length (minutes)</label>
                                            <input
                                                type="number"
                                                className="form-control mb-3"
                                                value={modalSlotLength}
                                                onChange={(e) => setModalSlotLength(e.target.value)}
                                                min={5}
                                                step={5}
                                            />
                                        </>
                                    )}
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                        Cancel
                                    </button>
                                    {modalMode === 'timed' ? (
                                        <button className="btn btn-primary" onClick={handleModalCreateTimed}>
                                            Create Event
                                        </button>
                                    ) : (
                                        <button className="btn btn-success" onClick={handleModalGenerateSlots}>
                                            Generate Slots
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} />
                </>
            )}
        </div>
    );
};

export default Calendar;
