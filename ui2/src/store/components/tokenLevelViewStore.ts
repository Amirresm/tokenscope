import { signal } from "@preact/signals-react";

export enum ColorVerbosityEnum {
    VERBOSE = "verbose",
    NORMAL = "normal",
    NONE = "none",
}

export default {
    colorVerbosity: signal<ColorVerbosityEnum>(ColorVerbosityEnum.NORMAL),
    specialTokenFilter: signal<boolean>(true),
    showLineInfo: signal<boolean>(false),
};
