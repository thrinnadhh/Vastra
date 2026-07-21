import type {
  ButtonPrimitive,
  ErrorStatePrimitive,
  FieldPrimitive,
  ToastPrimitive,
} from '@vastra/ui-primitives';
import type { AdminShellContract, MobileShellContract } from '@vastra/app-shells';

export interface FixtureViewport {
  readonly width: number;
  readonly height: number;
}

interface BaseFixtureDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly route: `/fixtures/${string}`;
  readonly viewport: FixtureViewport;
}

export interface PrimitiveFixtureDefinition extends BaseFixtureDefinition {
  readonly fixtureKind: 'primitive';
  readonly contract: ButtonPrimitive | FieldPrimitive | ErrorStatePrimitive | ToastPrimitive;
}

export interface MobileShellFixtureDefinition extends BaseFixtureDefinition {
  readonly fixtureKind: 'mobileShell';
  readonly contract: MobileShellContract;
}

export interface AdminShellFixtureDefinition extends BaseFixtureDefinition {
  readonly fixtureKind: 'adminShell';
  readonly contract: AdminShellContract;
}

export type FrontendFixtureDefinition =
  PrimitiveFixtureDefinition | MobileShellFixtureDefinition | AdminShellFixtureDefinition;

export interface FrontendE2EEntryPoint {
  readonly id: string;
  readonly owner: 'admin' | 'mobile';
  readonly fixtureId: string;
  readonly route: `/fixtures/${string}`;
  readonly viewport: FixtureViewport;
  readonly assertions: readonly string[];
}

export interface FrontendVisualEntryPoint {
  readonly id: string;
  readonly fixtureId: string;
  readonly route: `/fixtures/${string}`;
  readonly viewport: FixtureViewport;
}
