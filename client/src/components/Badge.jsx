const statusMap = {
  DRAFT: { label: 'Draft', class: 'badge-draft' },
  OPEN: { label: 'Open', class: 'badge-open' },
  IN_PROGRESS: { label: 'In Progress', class: 'badge-in-progress' },
  WAITING_FOLLOWUP: { label: 'Waiting Follow Up', class: 'badge-waiting-followup' },
  FOLLOWUP_ONGOING: { label: 'Follow Up Ongoing', class: 'badge-followup-ongoing' },
  PARTIALLY_CLOSED: { label: 'Partially Closed', class: 'badge-partially-closed' },
  CLOSED: { label: 'Closed', class: 'badge-closed' },
  NEW: { label: 'New', class: 'badge-new' },
  WAITING_PARTMAN: { label: 'Waiting Partman', class: 'badge-waiting-partman' },
  WAITING_SA_PRICING: { label: 'Waiting SA', class: 'badge-waiting-sa-pricing' },
  READY_FOLLOWUP: { label: 'Ready Follow Up', class: 'badge-ready-followup' },
  FOLLOWED_UP: { label: 'Followed Up', class: 'badge-followed-up' },
  WAITING_DECISION: { label: 'Waiting Decision', class: 'badge-waiting-decision' },
  APPROVED: { label: 'Approved', class: 'badge-approved' },
  DEFERRED: { label: 'Deferred', class: 'badge-deferred' },
  REJECTED: { label: 'Rejected', class: 'badge-rejected' },
  REPLACED: { label: 'Sudah Diganti', class: 'badge-replaced' },
  REPLACED_OTHER: { label: 'Ganti Dealer Lain', class: 'badge-replaced-other' },
  REPLACED_NONORI: { label: 'Ganti Non Ori', class: 'badge-replaced-nonori' },
  PART: { label: 'Part', class: 'badge-part' },
  JASA: { label: 'Jasa', class: 'badge-jasa' },
};

export default function Badge({ status }) {
  const info = statusMap[status] || { label: status, class: 'badge-draft' };
  return (
    <span className={`badge ${info.class}`}>
      <span className="badge-dot" />
      {info.label}
    </span>
  );
}

export function BadgeLabel({ status }) {
  return statusMap[status]?.label || status;
}
