import { act } from "react"
import React from "react"

Object.defineProperty(React, "act", { value: act, writable: true })

import "@testing-library/jest-dom/vitest"
