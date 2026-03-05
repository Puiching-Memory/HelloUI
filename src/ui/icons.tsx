import type { CSSProperties, FC } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Code2,
  Columns2,
  Copy,
  Download,
  EllipsisVertical,
  FileDown,
  FileText,
  Folder,
  Globe,
  Grid2x2,
  House,
  Image,
  ImagePlus,
  Info,
  List,
  Pencil,
  Plug,
  Plus,
  Search,
  Settings,
  Share2,
  Star,
  TriangleAlert,
  Trash2,
  Upload,
  User,
  Video,
  X,
  XCircle,
  Zap,
  ZoomIn,
  RefreshCw,
} from 'lucide-react';

type AnyProps = Omit<LucideProps, 'size'> & { fontSize?: number | string };

const parseFontSize = (fontSize?: number | string): number | undefined => {
  if (typeof fontSize === 'number') return fontSize;
  if (typeof fontSize === 'string') {
    const n = Number.parseFloat(fontSize);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

function createIcon(Icon: LucideIcon): FC<AnyProps> {
  const WrappedIcon: FC<AnyProps> = ({ fontSize, style, ...props }) => {
    const size = parseFontSize(fontSize) ?? 16;
    return <Icon aria-hidden="true" size={size} style={style as CSSProperties} {...props} />;
  };
  return WrappedIcon;
}

export const AddRegular = createIcon(Plus);
export const ArrowDownloadRegular = createIcon(Download);
export const ArrowRightRegular = createIcon(ArrowRight);
export const ArrowSyncRegular = createIcon(RefreshCw);
export const ArrowUploadRegular = createIcon(Upload);
export const CheckmarkCircleFilled = createIcon(CheckCircle2);
export const CheckmarkRegular = createIcon(Check);
export const ChevronDownRegular = createIcon(ChevronDown);
export const ChevronLeftRegular = createIcon(ChevronLeft);
export const ChevronRightRegular = createIcon(ChevronRight);
export const ChevronUpRegular = createIcon(ChevronUp);
export const CodeRegular = createIcon(Code2);
export const CopyRegular = createIcon(Copy);
export const DeleteRegular = createIcon(Trash2);
export const DismissCircleRegular = createIcon(XCircle);
export const DismissRegular = createIcon(X);
export const DocumentArrowDownRegular = createIcon(FileDown);
export const DocumentRegular = createIcon(FileText);
export const EditRegular = createIcon(Pencil);
export const FolderRegular = createIcon(Folder);
export const GlobeRegular = createIcon(Globe);
export const GridRegular = createIcon(Grid2x2);
export const HomeRegular = createIcon(House);
export const ImageAddRegular = createIcon(ImagePlus);
export const ImageRegular = createIcon(Image);
export const InfoRegular = createIcon(Info);
export const ListRegular = createIcon(List);
export const MoreVerticalRegular = createIcon(EllipsisVertical);
export const PersonRegular = createIcon(User);
export const PlugConnectedRegular = createIcon(Plug);
export const SearchRegular = createIcon(Search);
export const SettingsRegular = createIcon(Settings);
export const ShareRegular = createIcon(Share2);
export const SplitHorizontalRegular = createIcon(Columns2);
export const StarRegular = createIcon(Star);
export const TopSpeedRegular = createIcon(Zap);
export const VideoClipRegular = createIcon(Video);
export const WarningFilled = createIcon(TriangleAlert);
export const ZoomInRegular = createIcon(ZoomIn);
