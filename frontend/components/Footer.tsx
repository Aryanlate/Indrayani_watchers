'use client';

import React from 'react';
import { Waves, AlertCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer
      className="w-full border-t border-[#1E2C42] bg-[#0B1220] pb-20 md:pb-0"
      role="contentinfo"
      aria-label="Site footer with sensor disclaimer"
    >
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          {/* Left: Brand + Copyright */}
          <div className="flex items-start gap-3 flex-shrink-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#1E2C42] bg-[#121C2E]">
              <Waves className="h-4 w-4 text-[#22D3EE]" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-[#E6EDF7]">Indrayani Watch</span>
              <span className="text-xs text-[#8A9BB4] mt-0.5">
                © 2025 Indrayani Watch Project • MIT Academy of Engineering
              </span>
              <span className="text-[11px] text-[#8A9BB4]/70 mt-0.5">
                Electronics &amp; Telecommunication (ENTC) Department
              </span>
            </div>
          </div>

          {/* Right: Disclaimer */}
          <div className="flex flex-col max-w-2xl">
            <div className="flex items-start gap-2 rounded-xl border border-[#1E2C42] bg-[#121C2E]/60 p-3.5">
              <AlertCircle
                className="h-4 w-4 shrink-0 mt-0.5 text-[#FDE047]"
                aria-hidden="true"
              />
              <div className="text-xs leading-relaxed text-[#8A9BB4]">
                <p>
                  Readings shown are from low-cost calibrated IoT sensors deployed by student
                  researchers. Values are{' '}
                  <strong className="text-[#FDE047] font-semibold">indicative</strong> only and
                  do not constitute regulatory-grade data suitable for enforcement. Official
                  water quality determinations shall be based on certified laboratory analysis
                  per NABL / CPCB protocols. For public health concerns, contact your local
                  MPCB Regional Office or Municipal Water Supply Department.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
