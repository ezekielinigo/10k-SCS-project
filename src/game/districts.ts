import type { DistrictState } from "./types"

/*************** DISTRICT LOCATIONS */

export type LocationKind =
  | "shop"
  | "club"
  | "fixer"
  | "residential"
  | "street"
  | "faction_hq"
  | "hidden";

export interface LocationRequirements {
  minStoryStage?: number;          // e.g. chapter / act / main quest step
  requiredFlags?: string[];        // e.g. ["met_sound", "joined_ark"]
  forbiddenFlags?: string[];       // e.g. ["betrayed_cermie"]
  // you can expand this later with stats/rep/etc if needed
}

export interface DistrictLocation {
  id: string;
  name: string;
  districtId: string;              // matches DistrictState.id
  kind: LocationKind;
  controllingFaction?: FactionKey; // optional
  description?: string;
  tags: string[];
  requirements?: LocationRequirements;
}

/*************** DISTRICTS */

export type DistrictTier = "capital" | "redlined" | "fallen" | "deadzone";

export type SecurityLevel = "none" | "low" | "medium" | "high";
export type EconomyLevel = "collapsed" | "poor" | "average" | "wealthy";
export type FactionKey = "asi" | "corps" | "ark" | "minh" | "lattice" | "independent";

export interface DistrictStateTemplate {
  id: string;
  name: string;

  tier: DistrictTier;              // capital / redlined / fallen / deadzone
  controllingFaction: FactionKey;  // main owner or influence
  security: number;                // 0–100 raw
  unrest: number;                  // 0–100 raw
  economy: number;                 // 0–100 raw

  // optional "semantic" interpretation of the numbers
  securityLevel: SecurityLevel;
  economyLevel: EconomyLevel;

  // travel / gameplay
  adjacency: string[];             // ids of districts you can travel to
  description: string;             // brief flavour text
  locations?: DistrictLocation[];            // ids of key locations in this district
  tags: string[];                  // flavour & filters (nightlife, industrial, ark_stronghold, etc.)
}

export const DISTRICTS: Record<string, DistrictStateTemplate> = {
  // ============================================================
  // CAPITAL DISTRICTS
  // ============================================================
  capital_c1: {
    id: "capital_c1",
    name: "C1: Central Business District",
    tier: "capital",
    controllingFaction: "asi",

    security: 85,
    unrest: 20,
    economy: 95,

    securityLevel: "high",
    economyLevel: "wealthy",

    adjacency: ["capital_c23", "redlined_cliffcity"],
    description: "Corporate and financial core. Clean streets, surveillance, curated luxury.",

    tags: [
      "capital",
      "corp_core",
      "asi_surveillance",
      "white_collar",
      "high_security"
    ],
  },

  capital_c23: {
    id: "capital_c23",
    name: "C2-3: Shopping District",
    tier: "capital",
    controllingFaction: "asi",

    security: 60,
    unrest: 35,
    economy: 90,

    securityLevel: "medium",
    economyLevel: "wealthy",

    adjacency: ["capital_c1", "redlined_cermieshaven", "deadzone_northborder"],
    description: "Twin neon commercial zones merged together. Consumerism, nightlife, vice.",

    tags: [
      "capital",
      "shopping",
      "nightlife",
      "vice",
      "asi_surveillance"
    ],
  },

  // ============================================================
  // REDLINED DISTRICTS
  // ============================================================
  redlined_cliffcity: {
    id: "redlined_cliffcity",
    name: "Cliff City",
    tier: "redlined",
    controllingFaction: "independent",

    security: 20,
    unrest: 70,
    economy: 30,

    securityLevel: "low",
    economyLevel: "poor",

    adjacency: ["capital_c1", "fallen_oldminingdistrict"],
    description: "Warehousing sprawl. Camo workers, knockoff gear, street economies.",

    tags: [
      "redlined",
      "industrial",
      "warehouse",
      "camo_hub",
      "streetwear",
      "smuggling"
    ],
  },

  redlined_sanctuary: {
    id: "redlined_sanctuary",
    name: "Sanctuary",
    tier: "redlined",
    controllingFaction: "ark",

    security: 10,
    unrest: 80,
    economy: 15,

    securityLevel: "low",
    economyLevel: "poor",

    adjacency: [],
    description: "Ark headquarters. Crusade training grounds. Militant faith and discipline.",

    tags: [
      "redlined",
      "ark_stronghold",
      "militia",
      "religious",
      "power_armor"
    ],
  },

  redlined_cermieshaven: {
    id: "redlined_cermieshaven",
    name: "Cermie's Haven",
    tier: "redlined",
    controllingFaction: "independent",

    security: 25,
    unrest: 55,
    economy: 60,

    securityLevel: "low",
    economyLevel: "average",

    adjacency: ["capital_c23", "redlined_chodanshell", "deadzone_westborder"],
    description: "Outlaw professional hub. Hackers, sinths, mercenaries, black markets.",

    tags: [
      "redlined",
      "commercial",
      "nightlife",
      "black_market",
      "sinth_presence",
      "hacker_hub"
    ],

    // -----------------------
    // UNIQUE LOCATIONS
    // -----------------------
    locations: [
      {
        id: "cermieshaven_perennial",
        name: "Perennial",
        districtId: "redlined_cermieshaven",
        kind: "shop",
        tags: ["hacking", "daemons", "black_market", "int_focus"],
        description: "Hacking & daemon shop for netrunners and merc tacticians."
      },
      {
        id: "cermieshaven_uyeasound_front",
        name: "Uyea Sound (Front)",
        districtId: "redlined_cermieshaven",
        kind: "shop",
        tags: ["audio_tech", "front", "nightlife"],
        description: "Audio-tech store concealing the true entrance to the underground club."
      },
      {
        id: "cermieshaven_uyeasound_club",
        name: "Uyea Sound (Underground Club)",
        districtId: "redlined_cermieshaven",
        kind: "club",
        tags: ["hidden", "nightlife", "fixer_hub", "sinth_presence"],
        description: "Run by Ayue 'Sound' Xiang. Info brokerage & job board behind neon and bass."
      },
      {
        id: "cermieshaven_sanguine",
        name: "Sanguine",
        districtId: "redlined_cermieshaven",
        kind: "shop",
        tags: ["weapons", "melee", "blades"],
        description: "High-end blade dealer. Ritual steel, monomolecular edges."
      },
      {
        id: "cermieshaven_akk",
        name: "AKK",
        districtId: "redlined_cermieshaven",
        kind: "shop",
        tags: ["weapons", "ranged", "tech"],
        description: "Experimental firearms and prototype tech weapons."
      },
    ],
  },

  redlined_chodanshell: {
    id: "redlined_chodanshell",
    name: "Chodan's Hell",
    tier: "redlined",
    controllingFaction: "independent",

    security: 30,
    unrest: 60,
    economy: 35,

    securityLevel: "low",
    economyLevel: "poor",

    adjacency: ["redlined_cermieshaven", "fallen_oldminingdistrict"],
    description: "Smuggling checkpoint and border control for Haven. Taxes in bullets, not money.",

    tags: [
      "redlined",
      "border_zone",
      "protection_racket",
      "smuggling_hub"
    ],
  },

  // ============================================================
  // FALLEN DISTRICTS
  // ============================================================
  fallen_oldminingdistrict: {
    id: "fallen_oldminingdistrict",
    name: "Old Mining District",
    tier: "fallen",
    controllingFaction: "independent",

    security: 10,
    unrest: 80,
    economy: 15,

    securityLevel: "low",
    economyLevel: "collapsed",

    adjacency: ["redlined_cliffcity", "redlined_chodanshell", "deadzone_westborder"],
    description: "Collapsed tunnels and rusted roads. Fast, cheap, and deadly smuggling route.",

    tags: [
      "fallen",
      "mining",
      "bandit_activity",
      "smuggling_route",
      "hazardous_terrain"
    ],
  },

  fallen_blacklatticelabs: {
    id: "fallen_blacklatticelabs",
    name: "Black Lattice Labs",
    tier: "fallen",
    controllingFaction: "lattice",

    security: 95,
    unrest: 5,
    economy: 0,

    securityLevel: "high",
    economyLevel: "collapsed",

    adjacency: ["fallen_oldminingdistrict"],
    description: "Hidden research facility. No civilians. No witnesses. No promised return.",

    tags: [
      "fallen",
      "black_site",
      "lattice_facility",
      "no_civilians",
      "high_risk"
    ],
  },

  // ============================================================
  // DEAD ZONE
  // ============================================================
  deadzone_northborder: {
    id: "deadzone_northborder",
    name: "North Border",
    tier: "deadzone",
    controllingFaction: "asi",

    security: 5,
    unrest: 85,
    economy: 5,

    securityLevel: "none",
    economyLevel: "collapsed",

    adjacency: ["capital_c23", "deadzone_centralsitezero"],
    description: "Once-automated farms and factories. Now rust and forgotten machinery.",

    tags: [
      "deadzone",
      "wasteland",
      "industrial_ruins",
      "hazardous_air"
    ],
  },

  deadzone_southborder: {
    id: "deadzone_southborder",
    name: "South Border",
    tier: "deadzone",
    controllingFaction: "independent",

    security: 5,
    unrest: 90,
    economy: 5,

    securityLevel: "none",
    economyLevel: "collapsed",

    adjacency: ["deadzone_centralsitezero"],
    description: "Smog-choked divide. Acid storms, rotting plants, old reactors still humming.",

    tags: [
      "deadzone",
      "wasteland",
      "acid_storms",
      "toxic_zone"
    ],
  },

  deadzone_westborder: {
    id: "deadzone_westborder",
    name: "West Border",
    tier: "deadzone",
    controllingFaction: "independent",

    security: 10,
    unrest: 80,
    economy: 10,

    securityLevel: "low",
    economyLevel: "collapsed",

    adjacency: ["redlined_cermieshaven", "fallen_oldminingdistrict", "deadzone_centralsitezero"],
    description: "Rusted dunes and broken convoys. Last road before the anomaly.",

    tags: [
      "deadzone",
      "rusted_dunes",
      "desert_expanse",
      "old_convoys"
    ],
  },

  deadzone_centralsitezero: {
    id: "deadzone_centralsitezero",
    name: "Central Site Zero",
    tier: "deadzone",
    controllingFaction: "independent",

    security: 0,
    unrest: 100,
    economy: 0,

    securityLevel: "none",
    economyLevel: "collapsed",

    adjacency: ["deadzone_northborder", "deadzone_southborder", "deadzone_westborder"],
    description: "The anomaly heart. Electronics die instantly. No signal. No return.",

    tags: [
      "deadzone",
      "anomalous",
      "no_electronics",
      "no_return",
      "bomb_test_site"
    ],
  },
};



export const getDistrictById = (id: string): DistrictState | undefined =>
  DISTRICTS[id]

export default DISTRICTS
