"use client";

// src/components/nex-native/country-flare/FollowButtonWithShamrock.tsx
//
// Owner-authorised 2026-10-30 · thin client wrapper that composes the
// sealed FollowButton primitive with the sealed IrishShamrockBurst
// overlay. Each Follow / Unfollow state change (including rollbacks
// from server rejection) spawns a fresh shamrock burst when the
// target account is Irish. No-op when `isIrishOwner` is false.
//
// Why a wrapper: ProfileBody and other server-rendered surfaces
// cannot hold useState, so the burst-trigger state has to live
// inside a client component. The wrapper preserves the FollowButton
// prop surface verbatim and only adds the Irish flag + internal
// trigger state. If a caller passes their own `onStateChange`, it
// still fires AFTER the burst increment.
//
// Scoped to Ireland-only per sealed owner decision 2026-10-30
// ("Ireland-only hard-coded for Phase 1"). Future country-specific
// flare primitives are separate wrappers.

import * as React from "react";
import { FollowButton, type FollowButtonProps } from "@/components/nex-native/follow/FollowButton";
import { IrishShamrockBurst } from "./IrishShamrockBurst";

export interface FollowButtonWithShamrockProps extends FollowButtonProps {
  /** True when the target account should trigger an Irish shamrock
   *  burst on Follow / Unfollow. Resolved server-side via
   *  isIrishAccount(phone_country_code === '+353'). */
  readonly isIrishOwner: boolean;
}

export function FollowButtonWithShamrock(
  props: FollowButtonWithShamrockProps,
): React.JSX.Element {
  const { isIrishOwner, onStateChange: callerOnStateChange, ...rest } = props;
  const [shamrockTrigger, setShamrockTrigger] = React.useState(0);
  return (
    <>
      <FollowButton
        {...rest}
        onStateChange={(next) => {
          if (isIrishOwner) setShamrockTrigger((n) => n + 1);
          if (callerOnStateChange) callerOnStateChange(next);
        }}
      />
      {isIrishOwner && <IrishShamrockBurst trigger={shamrockTrigger} />}
    </>
  );
}
