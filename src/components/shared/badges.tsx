import {
  AlertTriangle,
  Building2,
  CircleDot,
  CloudRain,
  Flame,
  Footprints,
  LampDesk,
  MapPin,
  MessageSquareWarning,
  School,
  Store,
  Trash2,
  TreePine,
  Users,
  UsersRound,
  Waves,
  Zap,
} from "lucide-react";

import { CATEGORY_CONFIG } from "@/lib/constants";
import type { ConfidenceLabel, ReportCategoryKey, ReportStatus, RiskLevel } from "@/lib/types";
import { Badge } from "@/components/ui/primitives";
import { getConfidenceLabelText, getRiskLabel, titleCase } from "@/lib/utils";

export function RiskBadge({ risk_level }: { risk_level: RiskLevel }) {
  const tone = risk_level === "urgent" ? "danger" : risk_level === "serious" ? "warning" : risk_level === "watch" ? "caution" : "neutral";
  return <Badge tone={tone}>{getRiskLabel(risk_level)}</Badge>;
}

export function ConfidenceBadge({ confidence_label }: { confidence_label: ConfidenceLabel }) {
  const tone = confidence_label === "very_high" || confidence_label === "high" ? "success" : confidence_label === "medium" ? "accent" : "neutral";
  return <Badge tone={tone}>{getConfidenceLabelText(confidence_label)}</Badge>;
}

export function StatusBadge({ status }: { status: ReportStatus | string }) {
  const tone =
    status === "resolved"
      ? "success"
      : status === "verified"
        ? "success"
        : status === "in_progress"
          ? "accent"
      : status === "hidden" || status === "false_alarm" || status === "duplicate"
        ? "neutral"
        : status === "needs_review"
          ? "warning"
          : "accent";
  return <Badge tone={tone}>{titleCase(status)}</Badge>;
}

const iconMap = {
  "triangle-alert": AlertTriangle,
  "circle-dot": CircleDot,
  cone: AlertTriangle,
  waves: Waves,
  flame: Flame,
  zap: Zap,
  lamp: LampDesk,
  trash: Trash2,
  footprints: Footprints,
  "tree-pine": TreePine,
  "building-2": Building2,
  users: Users,
  school: School,
  "message-alert": MessageSquareWarning,
  store: Store,
  "users-round": UsersRound,
  "cloud-rain-wind": CloudRain,
  "map-pin": MapPin,
} as const;

export function CategoryIcon({ category, className }: { category: ReportCategoryKey; className?: string }) {
  const config = CATEGORY_CONFIG[category];
  const Icon = iconMap[config.icon as keyof typeof iconMap] || MapPin;
  return <Icon className={className} style={{ color: config.color }} aria-hidden="true" />;
}
