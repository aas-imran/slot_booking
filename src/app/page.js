"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Cookies from "js-cookie";
import html2canvas from "html2canvas";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import jsPDF from "jspdf";
import CryptoJS from "crypto-js";

const initialState = {
  projectName: "",
  departmentName: "",
  startDate: "",
  endDate: "",
  time: "",
  purpose: "",
  description: "",
  email: "",
};

const regex = {
  text: /^(?!.*(<|>|script|http|www|\.com|@)).{1,50}$/i,
  desc: /^(?!.*(<|>|script|http|www|\.com)).{0,200}$/i,
  email: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
};

const weekdayColors = [
  "text-green-600", // Sunday
  "text-blue-600", // Monday
  "text-orange-500", // Tuesday
  "text-yellow-600", // Wednesday
  "text-pink-500", // Thursday
  "text-amber-700", // Friday
  "text-purple-600", // Saturday
];
const weekdayBg = [
  "bg-green-100", // Sunday
  "bg-blue-100", // Monday
  "bg-orange-100", // Tuesday
  "bg-yellow-100", // Wednesday
  "bg-pink-100", // Thursday
  "bg-amber-100", // Friday
  "bg-purple-100", // Saturday
];

const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
const ampm = ["AM", "PM"];

const departmentOptions = ["IT", "Mines and minerals", "Management", "BioInformatices"];

const secretKey = "your-strong-secret-key"; // Change this to a strong, private key

export default function Home() {
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const [timeSelect, setTimeSelect] = useState({ hour: "", minute: "", ampm: "" });
  const ticketRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showBookings, setShowBookings] = useState(false);
  const [bookings, setBookings] = useState([]);

  // On mount, try to decrypt and load form data from cookie (only if not just booked)
  useEffect(() => {
    if (!success) {
      const encryptedData = Cookies.get("slotBooking");
      if (encryptedData) {
        try {
          const bytes = CryptoJS.AES.decrypt(encryptedData, secretKey);
          const decrypted = bytes.toString(CryptoJS.enc.Utf8);
          if (decrypted) {
            const parsed = JSON.parse(decrypted);
            setForm((prev) => ({ ...prev, ...parsed }));
          }
        } catch (err) {
          Cookies.remove("slotBooking");
        }
      }
    }
  }, [success]);

  // Load all bookings from cookies for the modal
  useEffect(() => {
    const encryptedList = Cookies.get("slotBookingList");
    if (encryptedList) {
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted) {
          const parsed = JSON.parse(decrypted);
          // Filter to only last 1 month
          const oneMonthAgo = new Date();
          oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
          const filtered = parsed.filter(b => new Date(b.startDate) >= oneMonthAgo);
          // Sort newest first
          filtered.sort((a, b) => new Date(b.createdAt || b.startDate) - new Date(a.createdAt || a.startDate));
          setBookings(filtered);
        }
      } catch {}
    } else {
      setBookings([]);
    }
  }, [showBookings, success]);

  const validate = () => {
    let errs = {};
    if (!regex.text.test(form.projectName)) errs.projectName = "Invalid project name.";
    if (!departmentOptions.includes(form.departmentName)) errs.departmentName = "Please select a department.";
    if (!form.startDate) errs.startDate = "Start date required.";
    if (!form.endDate) errs.endDate = "End date required.";
    if (!form.time) errs.time = "Time required.";
    if (!regex.text.test(form.purpose)) errs.purpose = "Invalid purpose.";
    if (!regex.desc.test(form.description)) errs.description = "Invalid description.";
    if (!regex.email.test(form.email)) errs.email = "Invalid email.";
    return errs;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePaste = (e) => {
    e.preventDefault();
  };

  const handleStartDateSelect = (date) => {
    if (date) {
      // Fix: Use local date string (YYYY-MM-DD) to avoid timezone issues
      const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      setForm((prev) => ({ ...prev, startDate: localDate }));
      setShowStartDate(false);
    }
  };

  const handleEndDateSelect = (date) => {
    if (date) {
      if (form.startDate) {
        const start = form.startDate;
        const end = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        if (end < start) {
          alert("End date cannot be before start date!");
          return;
        }
        setForm((prev) => ({ ...prev, endDate: end }));
        setShowEndDate(false);
      } else {
        const localDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        setForm((prev) => ({ ...prev, endDate: localDate }));
        setShowEndDate(false);
      }
    }
  };

  const handleTimeSelect = () => {
    if (timeSelect.hour && timeSelect.minute && timeSelect.ampm) {
      setForm((prev) => ({ ...prev, time: `${timeSelect.hour}:${timeSelect.minute} ${timeSelect.ampm}` }));
      setShowTime(false);
    }
  };

  const handleTimeDropdown = (e) => {
    const { name, value } = e.target;
    setTimeSelect((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      setLoading(false);
      return;
    }
    // Encrypt form data before storing in cookies (for prefill)
    const encryptedData = CryptoJS.AES.encrypt(JSON.stringify(form), secretKey).toString();
    Cookies.set("slotBooking", encryptedData, { expires: 7 });
    // Store in booking list (array of bookings)
    let bookingList = [];
    const encryptedList = Cookies.get("slotBookingList");
    if (encryptedList) {
      try {
        const bytes = CryptoJS.AES.decrypt(encryptedList, secretKey);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        if (decrypted) {
          bookingList = JSON.parse(decrypted);
        }
      } catch {}
    }
    bookingList.push({ ...form, createdAt: new Date().toISOString() });
    // Only keep last 1 month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    bookingList = bookingList.filter(b => new Date(b.startDate) >= oneMonthAgo);
    const encryptedListNew = CryptoJS.AES.encrypt(JSON.stringify(bookingList), secretKey).toString();
    Cookies.set("slotBookingList", encryptedListNew, { expires: 31 });
    const res = await fetch("/api/book-slot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setSuccess(true);
      setTicket({ ...form });
      // Clear form for next booking
      setForm(initialState);
      Cookies.remove("slotBooking");
    }
    setLoading(false);
  };

  // Back to form and clear
  const handleBackToForm = () => {
    setSuccess(false);
    setTicket(null);
    setForm(initialState);
    Cookies.remove("slotBooking");
  };

  // Clear form function
  const handleClearForm = () => {
    setForm(initialState);
    setErrors({});
    setTimeSelect({ hour: "", minute: "", ampm: "" });
    Cookies.remove("slotBooking");
  };

  // Helper to format booking number
  function getBookingNumber(startDate, time) {
    if (!startDate || !time) return '';
    const d = new Date(startDate);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    let [hh, min, ampm] = ["", "", ""];
    if (time) {
      const match = time.match(/(\d{2}):(\d{2})\s?(AM|PM)/i);
      if (match) {
        hh = match[1];
        min = match[2];
        ampm = match[3].toUpperCase();
      }
    }
    return `AAS${dd}${mm}${yy}${ampm}${hh}${min}`;
  }

  const handleSaveTicket = async (asPdf = false) => {
    if (!ticket) return;
    setSaved(false);
    if (asPdf) {
      // Generate PDF directly with jsPDF
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      let y = 50;
      // Gradient header (simulate with two rectangles)
      pdf.setFillColor(125, 146, 167); // #7d92a7
      pdf.rect(0, 0, 297, 80, 'F');
      pdf.setFillColor(125, 146, 167); // #586364
      pdf.rect(297, 0, 298, 80, 'F');
      pdf.setFontSize(24);
      pdf.setTextColor('#d1c061'); // gold heading
      pdf.text('Time Slot Book', 300, y, { align: 'center' });
      y += 60;
      pdf.setFontSize(18);
      pdf.setTextColor('#7d92a7');
      pdf.text('Your Slot Booking Successful !', 60, y);
      y += 28;
      pdf.setFontSize(12);
      pdf.setTextColor('#7d92a7');
      pdf.text(`Booking No: ${getBookingNumber(ticket.date, ticket.time)}`, 60, y);
      y += 30;
      pdf.setFontSize(13);
      pdf.setTextColor('#111');
      const labelWidth = 110;
      pdf.text('Project Name:', 60, y);
      pdf.text(`${ticket.projectName}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Department Name:', 60, y);
      pdf.text(`${ticket.departmentName}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Start Date:', 60, y);
      pdf.text(`${ticket.startDate}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('End Date:', 60, y);
      pdf.text(`${ticket.endDate}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Time:', 60, y);
      pdf.text(`${ticket.time}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Purpose:', 60, y);
      pdf.text(`${ticket.purpose}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Description:', 60, y);
      pdf.text(`${ticket.description}`, 60 + labelWidth, y);
      y += 24;
      pdf.text('Email:', 60, y);
      pdf.text(`${ticket.email}`, 60 + labelWidth, y);
      pdf.save('slot-booking-ticket.pdf');
      setSaved(true);
      return;
    }
    // ...existing image save logic (if needed)...
  };

  return (
    <div className="min-h-screen bg-blue-50 flex items-center justify-center py-8">
      <div className="w-full max-w-4xl md:mx-0 mx-2 sm:mx-4 max-w-sm sm:max-w-md md:max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden">
        {/* Left minor section */}
        <div className="w-full md:w-1/3 min-w-[120px] flex flex-col items-center justify-center bg-gradient-to-br from-[#7d92a7] to-[#586364] p-6 md:p-8 relative md:min-h-[600px] min-h-[180px]">
          <div className="flex flex-col items-center justify-center w-full h-full">
            <Image src="/aaslogo.png" alt="Company Logo" width={100} height={100} className="mb-3 md:mb-6 md:w-[100px] md:h-[100px] w-[60px] h-[60px]" style={{objectFit: 'contain'}} />
            <h2 className="text-lg md:text-2xl font-bold text-center bg-gradient-to-r from-[#d1c061] via-[#e6c068] to-[#c4b667] bg-clip-text text-transparent mb-1 md:mb-2">Time Slot Book</h2>
          </div>
          {/* <div className="w-full text-center absolute bottom-2 left-0 text-[11px] text-[#c0bf73] font-light select-none">
            @ 2025 copyright reserved AAS Information Technology
          </div> */}
        </div>
        {/* Right major section */}
        <div className="w-full md:w-2/3 flex flex-col items-center justify-center px-4 md:px-8 py-8 md:py-12 relative">
          {/* View Booked Slots button */}
          <button
            className="absolute  top-4 right-7  text-xs md:text-sm bg-gradient-to-r from-[#7d92a7] to-[#586364] hover:from-green-500 hover:to-green-800 text-white px-3 py-2 rounded shadow hover:scale-105 transition"
            onClick={() => setShowBookings(true)}
            type="button"
          >
            View Booked Slots
          </button>
          <div className="w-full max-w-xl">
            {!success ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-3 md:gap-4 w-full">
                <div>
                  <label className="block font-medium mb-1 text-black">Project Name</label>
                  <input
                    type="text"
                    name="projectName"
                    value={form.projectName}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    className="w-full px-3 py-2 bg-gray-100 text-black outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md transition-all duration-150 rounded-xl"
                    maxLength={50}
                    autoComplete="off"
                    required
                    placeholder="Enter project name"
                  />
                  {errors.projectName && <p className="text-red-500 text-xs mt-1">{errors.projectName}</p>}
                </div>
                <div>
                  <label className="block font-medium mb-1 text-black">Department Name</label>
                  <select
                    name="departmentName"
                    value={form.departmentName}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-100 text-black outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md transition-all duration-300 rounded-xl appearance-none cursor-pointer relative"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                    required
                  >
                    <option value="" className="py-2 text-gray-400">Select Department</option>
                    {departmentOptions.map((dept) => (
                      <option key={dept} value={dept} className="py-2 bg-gradient-to-r from-[#7d92a7] to-[#586364] text-white hover:from-[#586364] hover:to-[#7d92a7] transition-all duration-300">{dept}</option>
                    ))}
                  </select>
                  {errors.departmentName && <p className="text-red-500 text-xs mt-1">{errors.departmentName}</p>}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block font-medium mb-1 text-black">Start Date</label>
                    {form.startDate ? (
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-2 bg-gray-100 text-black border border-gray-200 rounded w-full flex items-center justify-between">
                          <span>{new Date(form.startDate).toLocaleDateString()}</span>
                          <button type="button" className="text-xs text-[#A259F7] underline ml-2" onClick={() => setShowStartDate(true)}>Change</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowStartDate(true)}
                        className="w-full px-3 py-2 bg-gray-100 text-gray-400 text-left outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md rounded-xl transition-all duration-150"
                      >
                        Select Start Date
                      </button>
                    )}
                    {showStartDate && (
                      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
                        <div className="bg-white text-black p-4 rounded-xl shadow-lg z-50">
                          <DayPicker
                            mode="single"
                            selected={form.startDate ? new Date(form.startDate) : undefined}
                            onSelect={handleStartDateSelect}
                            modifiersClassNames={{
                              selected: "bg-[#F7B32B] text-black rounded-md",
                              today: "border-0",
                              hover: "ring-2 ring-[#A259F7]",
                            }}
                            showOutsideDays
                            disabled={{ before: new Date() }}
                          />
                          <button className="mt-2 px-4 py-1 rounded bg-[#A259F7] text-white" onClick={() => setShowStartDate(false)} type="button">Close</button>
                        </div>
                      </div>
                    )}
                    {errors.startDate && <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>}
                  </div>
                  <div className="flex-1">
                    <label className="block font-medium mb-1 text-black">End Date</label>
                    {form.endDate ? (
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-2 bg-gray-100 text-black border border-gray-200 rounded w-full flex items-center justify-between">
                          <span>{new Date(form.endDate).toLocaleDateString()}</span>
                          <button type="button" className="text-xs text-[#A259F7] underline ml-2" onClick={() => setShowEndDate(true)}>Change</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowEndDate(true)}
                        className="w-full px-3 py-2 bg-gray-100 text-gray-400 text-left outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md rounded-xl transition-all duration-150"
                      >
                        Select End Date
                      </button>
                    )}
                    {showEndDate && (
                      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
                        <div className="bg-white text-black p-4 rounded-xl shadow-lg z-50">
                          <DayPicker
                            mode="single"
                            selected={form.endDate ? new Date(form.endDate) : undefined}
                            onSelect={handleEndDateSelect}
                            modifiersClassNames={{
                              selected: "bg-[#F7B32B] text-black rounded-md",
                              today: "border-0",
                              hover: "ring-2 ring-[#A259F7]",
                            }}
                            showOutsideDays
                            disabled={{
                              before: form.startDate ? new Date(form.startDate) : new Date(),
                            }}
                          />
                          <button className="mt-2 px-4 py-1 rounded bg-[#A259F7] text-white" onClick={() => setShowEndDate(false)} type="button">Close</button>
                        </div>
                      </div>
                    )}
                    {errors.endDate && <p className="text-red-500 text-xs mt-1">{errors.endDate}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block font-medium mb-1 text-black">Time</label>
                    {form.time ? (
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-2 bg-gray-100 text-black border border-gray-200 rounded w-full flex items-center justify-between">
                          <span>{form.time}</span>
                          <button type="button" className="text-xs text-[#F76D6D] underline ml-2" onClick={() => setShowTime(true)}>Change</button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowTime(true)}
                        className="w-full px-3 py-2 bg-gray-100 text-gray-400 text-left outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md rounded-xl transition-all duration-150"
                      >
                        Select Time
                      </button>
                    )}
                    {showTime && (
                      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
                        <div className="bg-white p-4 rounded-xl shadow-lg z-50 min-w-[260px]">
                          <div className="flex gap-2 mb-2">
                            <select name="hour" value={timeSelect.hour} onChange={handleTimeDropdown} className="border border-gray-200 rounded-xl px-2 py-1 text-black focus:border-[#7d92a7] focus:shadow-md transition-all duration-150">
                              <option value="">HH</option>
                              {hours.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <span className="text-black font-bold">:</span>
                            <select name="minute" value={timeSelect.minute} onChange={handleTimeDropdown} className="border border-gray-200 rounded-xl px-2 py-1 text-black focus:border-[#7d92a7] focus:shadow-md transition-all duration-150">
                              <option value="">MM</option>
                              {minutes.map((m) => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select name="ampm" value={timeSelect.ampm} onChange={handleTimeDropdown} className="border border-gray-200 rounded-xl px-2 py-1 text-black focus:border-[#7d92a7] focus:shadow-md transition-all duration-150">
                              <option value="">AM/PM</option>
                              {ampm.map((ap) => <option key={ap} value={ap}>{ap}</option>)}
                            </select>
                          </div>
                          <button
                            className="px-4 py-1 rounded bg-[#F76D6D] text-white mr-2"
                            type="button"
                            onClick={handleTimeSelect}
                            disabled={!(timeSelect.hour && timeSelect.minute && timeSelect.ampm)}
                          >
                            Set Time
                          </button>
                          <button className="px-4 py-1 rounded bg-gray-300 text-black" onClick={() => setShowTime(false)} type="button">Close</button>
                        </div>
                      </div>
                    )}
                    {errors.time && <p className="text-red-500 text-xs mt-1">{errors.time}</p>}
                  </div>
                  <div className="flex-1">
                    <label className="block font-medium mb-1 text-black">Purpose</label>
                    <input
                      type="text"
                      name="purpose"
                      value={form.purpose}
                      onChange={handleChange}
                      onPaste={handlePaste}
                      className="w-full px-3 py-2 bg-gray-100 text-black outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md transition-all duration-150 rounded-xl"
                      maxLength={50}
                      autoComplete="off"
                      required
                      placeholder="Enter purpose"
                    />
                    {errors.purpose && <p className="text-red-500 text-xs mt-1">{errors.purpose}</p>}
                  </div>
                </div>
                <div>
                  <label className="block font-medium mb-1 text-black">Description</label>
                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    onPaste={handlePaste}
                    className="w-full px-3 py-2 bg-gray-100 text-black outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md transition-all duration-150 rounded-xl"
                    maxLength={200}
                    rows={4}
                    autoComplete="off"
                    placeholder="Enter description"
                  />
                  {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
                </div>
                <div>
                  <label className="block font-medium mb-1 text-black">Your Email</label>
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    className="w-full px-3 py-2 bg-gray-100 text-black outline-none border border-gray-200 focus:border-[#7d92a7] focus:shadow-md transition-all duration-150 rounded-xl"
                    autoComplete="off"
                    required
                    placeholder="Enter your email"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
                </div>
                <div className="flex justify-end items-end mt-4 gap-3">
                  <button
                    type="button"
                    onClick={handleClearForm}
                    className="bg-gradient-to-r from-gray-400 to-gray-600 hover:from-red-400 hover:to-red-600 text-white font-semibold py-2 px-6 rounded transition-colors shadow-md flex items-center justify-center"
                    style={{ minWidth: 120 }}
                  >
                    Clear Form
                  </button>
                  <button
                    type="submit"
                    className={`bg-gradient-to-r from-[#7d92a7] to-[#586364] hover:from-green-500 hover:to-green-800 text-white font-semibold py-2  px-8 rounded transition-colors shadow-md flex items-center justify-center`}
                    style={{ minWidth: 160 }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>
                        Booking...
                      </>
                    ) : (
                      "Book Slot"
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col items-center gap-6 w-full max-w-xl">
                <div
                  ref={ticketRef}
                  className="bg-white rounded-xl shadow-lg p-6 w-full border-2 border-green-600 relative"
                  style={{ color: "#111" }}
                >
                  <h2 className="text-xl font-bold mb-2 text-green-600">Your Slot Booking Successful !</h2>
                  {/* Booking number below heading */}
                  {ticket && (
                    <div className="mb-2 text-xs font-bold text-green-700 bg-green-100 px-3 py-1 rounded shadow inline-block">
                      <span className="font-semibold">Booking No:</span> {getBookingNumber(ticket.date, ticket.time)}
                    </div>
                  )}
                  <div className="mt-2 text-sm text-gray-800 space-y-1">
                    <div className="flex"><span className="font-semibold min-w-[110px]">Project:</span><span className="ml-2">{ticket.projectName}</span></div>
                    <div className="flex"><span className="font-semibold min-w-[110px]">Department:</span><span className="ml-2">{ticket.departmentName}</span></div>
                    <div className="flex"><span className="font-semibold min-w-[110px]">Start Date:</span><span className="ml-2">{ticket.startDate}</span></div>
                    <div className="flex"><span className="font-semibold min-w-[110px]">End Date:</span><span className="ml-2">{ticket.endDate}</span></div>
                    <div className="flex"><span className="font-semibold min-w-[110px]">Time:</span><span className="ml-2">{ticket.time}</span></div>
                    <div className="flex"><span className="font-semibold min-w-[110px]">Purpose:</span><span className="ml-2">{ticket.purpose}</span></div>
                    <div className="flex"><span className="font-semibold min-w-[110px]">Description:</span><span className="ml-2">{ticket.description}</span></div>
                    <div className="flex"><span className="font-semibold min-w-[110px]">Email:</span><span className="ml-2">{ticket.email}</span></div>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Image src="/file.svg" alt="Ticket" width={24} height={24} />
                  </div>
                </div>
                <div className="flex flex-row gap-4 justify-center w-full">
                  <button
                    onClick={() => handleSaveTicket(true)}
                    className="bg-gradient-to-r from-[#7d92a7] to-[#586364] hover:from-gray-900 hover:to-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors mt-2"
                  >
                    Download as PDF
                  </button>
                  {/* Back button */}
                  <button
                    onClick={handleBackToForm}
                    className="bg-gradient-to-r from-[#7d92a7] to-[#586364] hover:from-gray-900 hover:to-gray-700 text-white font-semibold py-2 px-4 rounded transition-colors mt-2"
                    type="button"
                  >
                    Back
                  </button>
                </div>
                {saved && <div className="mt-2 text-green-600 font-semibold">Ticket saved to your device!</div>}
              </div>
            )}
          </div>
          {/* Booked slots modal */}
          {showBookings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
              <div className="bg-white rounded-xl shadow-lg p-6 max-w-md w-full relative">
                <button
                  className="absolute top-2 right-2 text-gray-500 hover:text-black"
                  onClick={() => setShowBookings(false)}
                  type="button"
                >
                  ✕
                </button>
                <h3 className="text-lg font-bold mb-4 text-[#4499a8]">Booked Slots (Last 1 Month)</h3>
                {bookings.length === 0 ? (
                  <div className="text-gray-500">No bookings found.</div>
                ) : (
                  <ul className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                    {bookings.map((b, i) => (
                      <li key={i} className="border rounded p-3 bg-gray-50 relative">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs text-black">Booked: {b.createdAt ? new Date(b.createdAt).toLocaleString() : ''}</span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gradient-to-r from-[#7d92a7] to-[#586364] text-white ml-2" style={{fontSize: '11px'}}>Bk No: {getBookingNumber(b.startDate, b.time)}</span>
                        </div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Project Name:</span><span className="ml-2">{b.projectName}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Dept. Name:</span><span className="ml-2">{b.departmentName}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Start Date:</span><span className="ml-2">{b.startDate}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">End Date:</span><span className="ml-2">{b.endDate}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Time slot:</span><span className="ml-2">{b.time}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Purpose:</span><span className="ml-2">{b.purpose}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Description:</span><span className="ml-2">{b.description}</span></div>
                        <div className="text-sm text-black flex"><span className="font-semibold min-w-[110px]">Email:</span><span className="ml-2">{b.email}</span></div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Add global style for weekday header coloring */}
      <style jsx global>{`
        .rdp-weekday:nth-child(1) { color: #16a34a; font-weight: 600; } /* Sun - green-600 */
        .rdp-weekday:nth-child(2) { color: #2563eb; font-weight: 600; } /* Mon - blue-600 */
        .rdp-weekday:nth-child(3) { color: #f59e42; font-weight: 600; } /* Tue - orange-500 */
        .rdp-weekday:nth-child(4) { color: #ca8a04; font-weight: 600; } /* Wed - yellow-600 */
        .rdp-weekday:nth-child(5) { color: #db2777; font-weight: 600; } /* Thu - pink-500 */
        .rdp-weekday:nth-child(6) { color: #b45309; font-weight: 600; } /* Fri - amber-700 */
        .rdp-weekday:nth-child(7) { color: #7c3aed; font-weight: 600; } /* Sat - purple-600 */
        /* Minimal thin scrollbar for modal */
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #7d92a7 #f3f3f3;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: linear-gradient(to bottom, #7d92a7, #586364);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(to bottom, #14532d, #111);
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f3f3f3;
        }
        /* Custom dropdown styling */
        select option {
          padding: 8px 12px;
          margin: 2px 0;
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        select option:hover {
          background: linear-gradient(90deg, #7d92a7 0%, #586364 100%);
          color: white;
        }
        select:focus option:checked {
          background: linear-gradient(90deg, #7d92a7 0%, #586364 100%);
          color: white;
        }
      `}</style>
      <style jsx global>{`
        input::placeholder, textarea::placeholder {
          color: #a3a3a3 !important;
          opacity: 1;
        }
        select option {
          color: #111;
        }
        select option[value=""] {
          color: #a3a3a3;
        }
      `}</style>
    </div>
  );
}
