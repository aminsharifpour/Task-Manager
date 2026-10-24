import PredictivePicker from "./predictive-picker";
import type { Request } from "./use-module";
export default function ResourcePicker({ api, resource, label, value, onChange, projectId,
  excludeId, required = false, activeOnly = false, disabled = false, currentLabel = "انتخاب فعلی",
}: { api: Request; resource: "projects" | "tasks" | "chat/conversations"; label: string;
  value: string; onChange: (value: string) => void; projectId?: string; excludeId?: string;
  required?: boolean; activeOnly?: boolean; disabled?: boolean; currentLabel?: string }) {
  return <PredictivePicker api={api} resource={resource} label={label} value={value}
    onChange={onChange} projectId={projectId} excludeId={excludeId} required={required}
    activeOnly={activeOnly} disabled={disabled} currentLabel={currentLabel}/>;
}
