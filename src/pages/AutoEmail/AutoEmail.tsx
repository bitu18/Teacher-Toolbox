import React, { useEffect, useState } from 'react';
import { getStudents } from '../../api-services/StudentsService';
import './AutoEmail.scss';

//firebase functions imports
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../firebase/firebaseConfig';

//Toastify notifications
import { toast } from 'react-toastify';

//type for one student
type Student = {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    age: number;
    gender: string;
    major: string;
};

function Autoemail() {
    //input fields
    const [to, setTo] = useState('');
    const [cc, setCc] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    const [preview, setPreview] = useState<string | null>(null); //status / result message
    const [isSending, setIsSending] = useState(false); //loading flag

    //drop down menu with student emails
    const [students, setStudents] = useState<Student[]>([]);

    //firebase functions setup
    const functions = getFunctions(app);
    const sendTeacherEmail = httpsCallable(functions, 'sendTeacherEmail');

    //load students from firebase
    useEffect(() => {
        const loadStudents = async () => {
            try {
                const data = await getStudents();

                if (data && data.students) {
                    const results = Object.entries(data.students).map(([id, student]) => ({
                        id,
                        ...(student as Omit<Student, 'id'>),
                    }));

                    setStudents(results);
                }
            } catch (err) {
                console.log('Error loading students: ', err);
                //show error if student list fails to load
                toast.error('Error loading students. Please try again.', {
                    position: 'bottom-right',
                    autoClose: 3000,
                });
            }
        };

        loadStudents();
    }, []);

    // Auto-fill the "To" field when selecting students
    const handleSelectStudent = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedEmail = e.target.value;
        if (!selectedEmail) return;

        const current = to
            .split(',')
            .map((email) => email.trim())
            .filter((email) => email.length > 0);

        if (!current.includes(selectedEmail)) {
            current.push(selectedEmail);
        }

        //put all selected emails into "To" field
        setTo(current.join(', '));
        setPreview(null);

        e.target.value = '';
    };

    //email validator
    const isValidEmail = (email: string) => {
        if (!email) return false;
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(email.trim());
    };

    //multiple emails from "To"
    const getToEmails = () => {
        if (!to) return [];
        return to
            .split(',')
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
    };

    //CC emails array
    const getCcEmails = () => {
        if (!cc) return [];
        return cc
            .split(',')
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
    };

    //Send email
    const handleSend = async () => {
        setPreview(null);

        const toEmails = getToEmails();
        const ccEmails = getCcEmails();
        const allRecipients = [...toEmails, ...ccEmails];

        //toastify notification for 'no recipients'

        if (allRecipients.length === 0) {
            toast.warning('Please add at least one recipient (To or CC).', {
                position: 'bottom-right',
                autoClose: 3000,
            });
            return;
        }

        //toastify notifcation for invalid emails
        const invalid = allRecipients.filter((email) => !isValidEmail(email));
        if (invalid.length > 0) {
            toast.warning('Invalid email(s): ' + invalid.join(', '), {
                position: 'bottom-right',
                autoClose: 3000,
            });
            return;
        }

        //toastify notification for missing subject / body
        if (!subject.trim() || !body.trim()) {
            toast.warning('Subject and Message cannot be empty.', {
                position: 'bottom-right',
                autoClose: 3000,
            });
            return;
        }

        try {
            setIsSending(true);

            //call backend function
            const payload = {
                to: toEmails,
                cc: ccEmails,
                subject: subject.trim(),
                body: body.trim(),
            };

            console.log('Sending payload to function:', payload);
            const result = await sendTeacherEmail(payload);
            console.log('Function returned:', result?.data);

            //toast notifcation for successfull send
            toast.success('Email sent successfully!', {
                position: 'bottom-right',
                autoClose: 3000,
            });

            //create preview receipt
            setPreview('Email sent! See details below.');
        } catch (err: any) {
            console.error('sendTeacherEmail error (frontend):', err);

            //toast notification for unsuccessfull send
            toast.error('There was an issue sending the email.', {
                position: 'bottom-right',
                autoClose: 3000,
            });

            setPreview('Error sending email.');
        } finally {
            setIsSending(false);
        }
    };

    //clear all fields
    const handleCancel = () => {
        setTo('');
        setCc('');
        setSubject('');
        setBody('');
        setPreview(null);
    };

    const ccEmails = getCcEmails();
    const toEmails = getToEmails();

    //render-----------------------------------------------------------------------------------
    return (
        <div className="autoemail-container">
            <h2 className="autoemail-title">Auto-email</h2>

            {/*Student dropdown*/}
            <div className="form-group">
                <label>Select Student</label>
                <select className="form-select" defaultValue="" onChange={handleSelectStudent}>
                    <option value="" disabled>
                        Select student...
                    </option>
                    {students.map((s) => (
                        <option key={s.id} value={s.email}>
                            {s.firstname} {s.lastname} = {s.email}
                        </option>
                    ))}
                </select>
            </div>

            <div className="autoemail-row">
                {/*To Field*/}
                <div className="form-group">
                    <label htmlFor="to">To</label>
                    <input
                        id="to"
                        type="text"
                        className="form-control"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        placeholder="FirstName.LastName@school.edu"
                    />
                </div>
                {/*CC Field*/}
                <div className="form-group">
                    <label htmlFor="cc">Cc</label>
                    <input
                        id="cc"
                        type="text"
                        className="form-control"
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                    />
                </div>
            </div>

            {/*Subject Field*/}
            <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input
                    id="subject"
                    type="text"
                    className="form-control"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                />
            </div>

            {/*Message Field*/}
            <div className="form-group">
                <label htmlFor="body">Message</label>
                <textarea
                    id="body"
                    className="form-control"
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write message here..."
                />
            </div>

            {/*Send Button*/}
            <div className="autoemail-buttons">
                <button type="button" className="btn-send" onClick={handleSend} disabled={isSending}>
                    {isSending ? 'Sending...' : 'Send'}
                </button>

                {/*Clear Button*/}
                <button type="button" className="btn-clear" onClick={handleCancel}>
                    Clear
                </button>
            </div>

            {/*preview section*/}
            {preview && (
                <div className="autoemail-preview-box">
                    <p className="autoemail-preview-title">{preview}</p>
                    <div className="autoemail-preview-info">
                        <p>
                            <strong>To:</strong> {toEmails.length > 0 ? toEmails.join(', ') : '(none)'}
                        </p>
                        <p>
                            <strong>CC:</strong> {ccEmails.length > 0 ? ccEmails.join(', ') : '(none)'}
                        </p>
                        <p>
                            <strong>Subject:</strong> {subject}
                        </p>
                        <p>
                            <strong>Message:</strong>
                        </p>
                        <div className="autoemail-preview-body">{body}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
export default Autoemail;
