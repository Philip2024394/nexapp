// src/app/nex-native/free-chat/_contact-picker-data.ts
//
// Mock profiles for the Contact-picker carousel. Owner directive
// 2026-10-22 (evening · pass 16) · 12 varied profiles so the carousel
// shows real-looking NEX diversity (founder, verified NEX1, business
// owners, service providers, non-business users). Swap this out for
// a real contacts query (nex_account via peer_conversation_participant
// + nex_business.owner_account_id check) when the backing service
// lands.

export type ContactPresence = "online" | "away" | "offline";

export interface MockContact {
  readonly id: string;
  readonly nexHandle: string;      // "NEX-10842"
  readonly displayName: string;
  readonly profession: string;
  readonly city: string | null;
  readonly presence: ContactPresence;
  readonly lastSeenMinsAgo: number | null;  // null if online
  readonly hasShop: boolean;
  readonly shopName: string | null;         // display name when sharing
  readonly isVerified: boolean;             // NEX cyan tick
  readonly hasActiveStatus: boolean;        // 24h status ring
  // Owner directive 2026-10-22 (evening · pass 20) · live unread
  // count from the viewer's conversation with this contact. The
  // avatar badge paints this number (hidden when 0). Replace with a
  // real peer_message read-receipt query when the backing service
  // lands.
  readonly unreadCount: number;
  // Avatar fallback · 1-2 character initials shown when the real
  // profile image hasn't loaded. Mock set uses initials only (no
  // image URLs) so the carousel renders without external asset
  // dependencies.
  readonly initials: string;
}

export const MOCK_CONTACTS: ReadonlyArray<MockContact> = [
  {
    id: "nex-10842",
    nexHandle: "NEX-10842",
    displayName: "Philip O'Farrell",
    profession: "NEX Founder",
    city: "London",
    presence: "online",
    lastSeenMinsAgo: null,
    hasShop: true,
    shopName: "NEX Store",
    isVerified: true,
    hasActiveStatus: true,
    unreadCount: 2,
    initials: "PO",
  },
  {
    id: "nex-00001",
    nexHandle: "NEX-00001",
    displayName: "NEX1 Official",
    profession: "NEX Support",
    city: null,
    presence: "online",
    lastSeenMinsAgo: null,
    hasShop: false,
    shopName: null,
    isVerified: true,
    hasActiveStatus: false,
    unreadCount: 1,
    initials: "N1",
  },
  {
    id: "nex-23451",
    nexHandle: "NEX-23451",
    displayName: "Maria Santos",
    profession: "Photographer",
    city: "Yogyakarta",
    presence: "online",
    lastSeenMinsAgo: null,
    hasShop: true,
    shopName: "Maria Portraits",
    isVerified: false,
    hasActiveStatus: true,
    unreadCount: 5,
    initials: "MS",
  },
  {
    id: "nex-61245",
    nexHandle: "NEX-61245",
    displayName: "Crispy Chicken",
    profession: "Restaurant owner",
    city: "Jakarta",
    presence: "online",
    lastSeenMinsAgo: null,
    hasShop: true,
    shopName: "Crispy Chicken Jakarta",
    isVerified: true,
    hasActiveStatus: false,
    unreadCount: 0,
    initials: "CC",
  },
  {
    id: "nex-55102",
    nexHandle: "NEX-55102",
    displayName: "Hammer Ex Products",
    profession: "Industrial hardware",
    city: "Surabaya",
    presence: "away",
    lastSeenMinsAgo: 15,
    hasShop: true,
    shopName: "Hammer Ex",
    isVerified: true,
    hasActiveStatus: false,
    unreadCount: 24,
    initials: "HE",
  },
  {
    id: "nex-33678",
    nexHandle: "NEX-33678",
    displayName: "Lisa Rodriguez",
    profession: "Fitness coach",
    city: "Bali",
    presence: "online",
    lastSeenMinsAgo: null,
    hasShop: true,
    shopName: "Lisa Fit Club",
    isVerified: false,
    hasActiveStatus: true,
    unreadCount: 0,
    initials: "LR",
  },
  {
    id: "nex-77281",
    nexHandle: "NEX-77281",
    displayName: "Dr. James Okafor",
    profession: "Doctor",
    city: "Jakarta",
    presence: "away",
    lastSeenMinsAgo: 32,
    hasShop: false,
    shopName: null,
    isVerified: true,
    hasActiveStatus: false,
    unreadCount: 1,
    initials: "JO",
  },
  {
    id: "nex-66524",
    nexHandle: "NEX-66524",
    displayName: "Priya Patel",
    profession: "Yoga instructor",
    city: "Bali",
    presence: "online",
    lastSeenMinsAgo: null,
    hasShop: true,
    shopName: "Priya Flow",
    isVerified: false,
    hasActiveStatus: true,
    unreadCount: 3,
    initials: "PP",
  },
  {
    id: "nex-98123",
    nexHandle: "NEX-98123",
    displayName: "Sarah Chen",
    profession: "UX Designer",
    city: "Singapore",
    presence: "offline",
    lastSeenMinsAgo: 240,
    hasShop: false,
    shopName: null,
    isVerified: false,
    hasActiveStatus: false,
    unreadCount: 0,
    initials: "SC",
  },
  {
    id: "nex-18735",
    nexHandle: "NEX-18735",
    displayName: "Ahmed Hassan",
    profession: "Software engineer",
    city: "Dubai",
    presence: "away",
    lastSeenMinsAgo: 8,
    hasShop: false,
    shopName: null,
    isVerified: false,
    hasActiveStatus: false,
    unreadCount: 0,
    initials: "AH",
  },
  {
    id: "nex-40011",
    nexHandle: "NEX-40011",
    displayName: "Mike's Delivery",
    profession: "Logistics",
    city: "Jakarta",
    presence: "online",
    lastSeenMinsAgo: null,
    hasShop: true,
    shopName: "Mike Delivery Jkt",
    isVerified: false,
    hasActiveStatus: false,
    unreadCount: 112,
    initials: "MD",
  },
  {
    id: "nex-82901",
    nexHandle: "NEX-82901",
    displayName: "Elena Volkov",
    profession: "Travel blogger",
    city: "Prague",
    presence: "offline",
    lastSeenMinsAgo: 1440,
    hasShop: false,
    shopName: null,
    isVerified: false,
    hasActiveStatus: true,
    unreadCount: 0,
    initials: "EV",
  },
];

export function formatContactPresenceLabel(c: MockContact): string {
  if (c.presence === "online") return "Online now";
  if (c.presence === "away" && c.lastSeenMinsAgo !== null) {
    if (c.lastSeenMinsAgo < 60) return `Away · ${c.lastSeenMinsAgo}m ago`;
    const h = Math.round(c.lastSeenMinsAgo / 60);
    return `Away · ${h}h ago`;
  }
  if (c.lastSeenMinsAgo !== null) {
    if (c.lastSeenMinsAgo < 60) return `Offline · ${c.lastSeenMinsAgo}m ago`;
    if (c.lastSeenMinsAgo < 60 * 24) {
      return `Offline · ${Math.round(c.lastSeenMinsAgo / 60)}h ago`;
    }
    return `Offline · ${Math.round(c.lastSeenMinsAgo / (60 * 24))}d ago`;
  }
  return "Offline";
}
