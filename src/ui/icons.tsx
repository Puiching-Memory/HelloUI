import type { CSSProperties, FC } from 'react';
import {
  PlusOutlined,
  DownloadOutlined,
  ArrowRightOutlined,
  SyncOutlined,
  UploadOutlined,
  CheckCircleFilled,
  CheckOutlined,
  DownOutlined,
  LeftOutlined,
  RightOutlined,
  UpOutlined,
  CodeOutlined,
  CopyOutlined,
  DeleteOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  FileTextOutlined,
  FileDoneOutlined,
  EditOutlined,
  FolderOutlined,
  GlobalOutlined,
  AppstoreOutlined,
  HomeOutlined,
  PictureOutlined,
  FileImageOutlined,
  InfoCircleOutlined,
  UnorderedListOutlined,

  ApiOutlined,
  SearchOutlined,
  SettingOutlined,
  ShareAltOutlined,
  ColumnWidthOutlined,
  StarOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
  WarningFilled,
  ZoomInOutlined,
} from '@ant-design/icons';

type AnyProps = {
  fontSize?: number | string;
  style?: CSSProperties;
  className?: string;
  [key: string]: unknown;
};

const parseFontSize = (fontSize?: number | string): number | undefined => {
  if (typeof fontSize === 'number') return fontSize;
  if (typeof fontSize === 'string') {
    const n = Number.parseFloat(fontSize);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
};

function createIcon(Icon: FC<any>): FC<AnyProps> {
  const WrappedIcon: FC<AnyProps> = ({ fontSize, style, ...props }) => {
    const size = parseFontSize(fontSize) ?? 16;
    return <Icon style={{ fontSize: size, ...(style as CSSProperties) }} {...props} />;
  };
  return WrappedIcon;
}

export const AddRegular = createIcon(PlusOutlined);
export const ArrowDownloadRegular = createIcon(DownloadOutlined);
export const ArrowRightRegular = createIcon(ArrowRightOutlined);
export const ArrowSyncRegular = createIcon(SyncOutlined);
export const ArrowUploadRegular = createIcon(UploadOutlined);
export const CheckmarkCircleFilled = createIcon(CheckCircleFilled);
export const CheckmarkRegular = createIcon(CheckOutlined);
export const ChevronDownRegular = createIcon(DownOutlined);
export const ChevronLeftRegular = createIcon(LeftOutlined);
export const ChevronRightRegular = createIcon(RightOutlined);
export const ChevronUpRegular = createIcon(UpOutlined);
export const CodeRegular = createIcon(CodeOutlined);
export const CopyRegular = createIcon(CopyOutlined);
export const DeleteRegular = createIcon(DeleteOutlined);
export const DismissCircleRegular = createIcon(CloseCircleOutlined);
export const DismissRegular = createIcon(CloseOutlined);
export const DocumentArrowDownRegular = createIcon(FileDoneOutlined);
export const DocumentRegular = createIcon(FileTextOutlined);
export const EditRegular = createIcon(EditOutlined);
export const FolderRegular = createIcon(FolderOutlined);
export const GlobeRegular = createIcon(GlobalOutlined);
export const GridRegular = createIcon(AppstoreOutlined);
export const HomeRegular = createIcon(HomeOutlined);
export const ImageAddRegular = createIcon(FileImageOutlined);
export const ImageRegular = createIcon(PictureOutlined);
export const InfoRegular = createIcon(InfoCircleOutlined);
export const ListRegular = createIcon(UnorderedListOutlined);

export const PlugConnectedRegular = createIcon(ApiOutlined);
export const SearchRegular = createIcon(SearchOutlined);
export const SettingsRegular = createIcon(SettingOutlined);
export const ShareRegular = createIcon(ShareAltOutlined);
export const SplitHorizontalRegular = createIcon(ColumnWidthOutlined);
export const StarRegular = createIcon(StarOutlined);
export const TopSpeedRegular = createIcon(ThunderboltOutlined);
export const VideoClipRegular = createIcon(VideoCameraOutlined);
export { WarningFilled };
export const ZoomInRegular = createIcon(ZoomInOutlined);
