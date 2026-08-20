/*
 * Which export formats exist, and which of them work right now.
 *
 * One module rather than props threaded down from Header: the menu, the format
 * hook and the dispatcher all need the same answer, and a format that is present
 * but not yet wired (DOCX, until 6d.2) has to be describable — visible in the
 * menu, disabled, with a reason the UI can show.
 */

export const EXPORT_FORMATS = [
  {
    id: 'pdf',
    label: 'PDF',
    actionLabel: 'Save as PDF',
    extension: 'pdf',
    available: true,
  },
  {
    id: 'html',
    label: 'HTML',
    actionLabel: 'Save as HTML',
    extension: 'html',
    available: true,
  },
  {
    id: 'docx',
    label: 'DOCX',
    actionLabel: 'Save as DOCX',
    extension: 'docx',
    available: false,
    unavailableReason: 'coming in 6d.2',
  },
];

export const FORMAT_IDS = EXPORT_FORMATS.map((f) => f.id);

export const formatById = (id) =>
  EXPORT_FORMATS.find((f) => f.id === id) ?? EXPORT_FORMATS[0];

export const isFormatAvailable = (id) => formatById(id).available === true;

/**
 * The format to actually act on.
 *
 * A stored choice for a format that is not available yet degrades to PDF for
 * *this session* without overwriting what the user picked — when the format
 * lands, their choice is still there.
 */
export const effectiveFormat = (id) => (isFormatAvailable(id) ? id : 'pdf');
