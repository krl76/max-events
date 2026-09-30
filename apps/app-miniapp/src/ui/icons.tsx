// START_MODULE_CONTRACT
// PURPOSE: Icon set of the miniapp: lucide-react glyphs behind the closed name unions used across screens (approved swap of the hand-drawn set, see the icon gallery review).
// SCOPE: 24px grid, 1.7 stroke, currentColor; filled paints the glyph (liked heart, saved bookmark, active tab); names are a closed union derived from the registries.
// DEPENDS: lucide-react, react
// LINKS: M-APP-MINIAPP
// END_MODULE_CONTRACT
//
// START_MODULE_MAP
// - TabIcon - union of the tabbar icon names: the user bar (feed/search/create/plans/profile) plus map and the organizer bar (dashboard/events/create/promo/profile)
// - TAB_GLYPHS - lucide component per tabbar name
// - ActionIconName - the icon names, derived from the ACTIONS registry: a new glyph is one entry there and nothing else
// - TabIconGlyph - lucide glyph by TabIcon, filled variant for the active tab
// - ActionIcon - lucide glyph by ActionIconName; filled=true paints the glyph
// END_MODULE_MAP

import type { LucideIcon } from "lucide-react";
import { AlignVerticalJustifyCenter, ArrowRight, ArrowUp, Armchair, BarChart3, Bell, Bookmark, Building, CalendarDays, Camera, Car, Check, ChevronRight, CircleAlert, Clock, CloudRain, CloudSun, CreditCard, Ellipsis, Eye, Group, Heart, House, Info, Layers, Link, List, LocateFixed, Lock, Mail, MapPin, Medal, Megaphone, MessageCircle, Minus, Navigation, PenLine, Percent, PersonStanding, Plus, RefreshCw, Repeat2, ScanQrCode, Search, Send, Settings, ShieldCheck, SlidersHorizontal, Sparkles, SquarePlus, SquareStack, Star, Sun, Tag, Target, TextAlignCenter, TextAlignStart, Ticket, Trash2, TramFront, TrendingUp, Undo2, Upload, User, Users, UsersRound, Wallet, WandSparkles, X } from "lucide-react";

export type TabIcon = "feed" | "search" | "create" | "map" | "plans" | "profile" | "dashboard" | "events" | "promo" | "finance";

const TAB_GLYPHS: Record<TabIcon, LucideIcon> = {
  feed: House,
  search: Search,
  create: SquarePlus,
  map: MapPin,
  plans: Bookmark,
  profile: User,
  dashboard: House,
  events: CalendarDays,
  promo: Megaphone,
  finance: CreditCard,
};

/**
 * The registry is the single source of truth, and the name union is derived from it: a new glyph is one
 * entry here and nothing else. The union used to be spelled out by hand next to the object, which made
 * every parallel branch edit the same long line and turned additions into merge conflicts.
 */
const ACTIONS = {
  heart: Heart,
  comment: MessageCircle,
  share: Send,
  bookmark: Bookmark,
  pin: MapPin,
  clock: Clock,
  ticket: Ticket,
  user: User,
  chevron: ChevronRight,
  star: Star,
  alert: CircleAlert,
  search: Search,
  bell: Bell,
  check: Check,
  plus: Plus,
  building: Building,
  spark: Sparkles,
  cards: SquareStack,
  calendar: CalendarDays,
  arrow: ArrowRight,
  up: ArrowUp,
  seat: Armchair,
  filter: SlidersHorizontal,
  close: X,
  undo: Undo2,
  users: Users,
  text: TextAlignCenter,
  adjust: AlignVerticalJustifyCenter,
  sparkle: WandSparkles,
  friends: UsersRound,
  weather: CloudSun,
  rain: CloudRain,
  navigation: Navigation,
  walk: PersonStanding,
  metro: TramFront,
  layers: Layers,
  locate: LocateFixed,
  upload: Upload,
  dots: Ellipsis,
  medal: Medal,
  group: Group,
  camera: Camera,
  lines: TextAlignStart,
  tag: Tag,
  settings: Settings,
  lock: Lock,
  car: Car,
  sun: Sun,
  qr: ScanQrCode,
  megaphone: Megaphone,
  trend: TrendingUp,
  shield: ShieldCheck,
  refresh: RefreshCw,
  repost: Repeat2,
  minus: Minus,
  eye: Eye,
  trash: Trash2,
  wallet: Wallet,
  percent: Percent,
  target: Target,
  mail: Mail,
  list: List,
  link: Link,
  bars: BarChart3,
  pen: PenLine,
  info: Info,
} satisfies Record<string, LucideIcon>;

export type ActionIconName = keyof typeof ACTIONS;

function Glyph({ icon: Icon, size, filled, strokeWidth }: { icon: LucideIcon; size: number; filled: boolean; strokeWidth: number }) {
  return <Icon aria-hidden="true" fill={filled ? "currentColor" : "none"} size={size} strokeWidth={strokeWidth} />;
}

export function TabIconGlyph({ name, size = 24, filled = false }: { name: TabIcon; size?: number; filled?: boolean }) {
  return <Glyph icon={TAB_GLYPHS[name]} size={size} filled={filled} strokeWidth={1.7} />;
}

export function ActionIcon({ name, size = 24, filled = false, strokeWidth = 1.7 }: { name: ActionIconName; size?: number; filled?: boolean; strokeWidth?: number }) {
  return <Glyph icon={ACTIONS[name]} size={size} filled={filled} strokeWidth={strokeWidth} />;
}
