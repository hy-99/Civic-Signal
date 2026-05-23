import { CATEGORY_OPTIONS, URGENCY_OPTIONS } from "@/lib/constants";
import { Input, Select } from "@/components/ui/primitives";

export function FilterPanel() {
  return (
    <div className="civic-light-card grid gap-4 rounded-[2rem] p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-700">Map filters</p>
        <h3 className="mt-1 text-lg font-black tracking-[-0.03em] text-slate-950">Focus the area</h3>
      </div>
      <Input readOnly placeholder="Search signals or reports" className="civic-light-input" />
      <Select defaultValue="all" className="civic-light-input">
        <option value="all">All categories</option>
        {CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select defaultValue="all" className="civic-light-input">
        <option value="all">All risk levels</option>
        {URGENCY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <Select defaultValue="urgent" className="civic-light-input">
        <option value="urgent">Sort by most urgent</option>
        <option value="recent">Sort by most recent</option>
        <option value="confirmed">Sort by most confirmed</option>
        <option value="confidence">Sort by highest confidence</option>
      </Select>
    </div>
  );
}
