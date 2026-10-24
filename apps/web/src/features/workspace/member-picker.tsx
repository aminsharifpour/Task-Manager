import PredictivePicker from "./predictive-picker";
import type { Request } from "./use-module";
export default function MemberPicker({ api, label, value, onChange, includeGuests = false,
  excludeUserId, required = false, disabled = false, currentLabel = "عضو انتخاب‌شده",
}: { api: Request; label: string; value: string; onChange: (value: string) => void;
  includeGuests?: boolean; excludeUserId?: string; required?: boolean; disabled?: boolean; currentLabel?: string }) {
  return <PredictivePicker api={api} resource="members" label={label} value={value}
    onChange={onChange} includeGuests={includeGuests} excludeId={excludeUserId}
    required={required} disabled={disabled} currentLabel={currentLabel}/>;
}
