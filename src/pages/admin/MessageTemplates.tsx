import React from 'react';

const MessageTemplates = () => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-primary font-display">Communication Templates</h1>
                    <p className="text-slate-500 text-sm">Automated SMS/Email structures for lead follow-ups.</p>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-[var(--shadow-card)] p-12 flex flex-col items-center justify-center text-center h-[50vh]">
                <div className="size-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6">
                    <span className="material-symbols-outlined text-4xl">mark_email_unread</span>
                </div>
                <h2 className="text-2xl font-black text-primary font-display mb-2">WhatsApp / SMS API Pending</h2>
                <p className="text-slate-500 max-w-md mx-auto mb-4">
                    The Communication Engine is scheduled to be wired during Phase 2 Rollout via Twilio or Gupshup API integrations. 
                    Local mockup structures have been deactivated.
                </p>
                <div className="flex items-center gap-2 p-3 bg-slate-50 text-slate-500 rounded-lg text-xs font-bold w-max mx-auto border border-slate-200">
                    <span className="material-symbols-outlined text-sm">electrical_services</span> Architecture Awariting Provider
                </div>
            </div>
        </div>
    );
};

export default MessageTemplates;
