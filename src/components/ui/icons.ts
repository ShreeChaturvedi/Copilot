import type { ComponentType } from 'react';
import {
  Home,
  Calendar,
  CheckSquare,
  Folder,
  List,
  User,
  Bell,
  BellRing,
  MapPin,
  Tag,
  Flag,
  Info,
  Trash2,
  Plus,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Search,
  X,
  ArrowUp,
} from 'lucide-react';

export type IconComponent = ComponentType<{ className?: string; size?: number }>;

export const IconRegistry: Record<string, IconComponent> = {
  Home,
  Calendar,
  CheckSquare,
  Folder,
  List,
  User,
  Bell,
  BellRing,
  MapPin,
  Tag,
  Flag,
  Info,
  Trash2,
  Plus,
  MoreVertical,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  Search,
  X,
  ArrowUp,
};

export type IconName = keyof typeof IconRegistry | string;

export function getIconByName(name: string, fallback: IconComponent = CheckSquare): IconComponent {
  return (IconRegistry as Record<string, IconComponent>)[name] || fallback;
}

export const iconNames: string[] = Object.keys(IconRegistry);


