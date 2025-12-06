import { useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Dropdown,
  Input,
  ProgressBar,
  Radio,
  RadioGroup,
  Slider,
  Switch,
  Text,
  makeStyles,
  tokens,
  Body1,
  Title2,
  Caption1,
  Avatar,
  Badge,
  PresenceBadge,
  Spinner,
  Tooltip,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  List,
  ListItem,
  Divider,
  TabList,
  Tab,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuDivider,
  Dialog,
  DialogTrigger,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  DialogContent,
  CompoundButton,
  MenuButton,
  SplitButton,
  ToggleButton,
  Combobox,
  Option,
  SpinButton,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbButton,
  Link,
  Popover,
  PopoverTrigger,
  PopoverSurface,
  Accordion,
  AccordionItem,
  AccordionHeader,
  AccordionPanel,
  Skeleton,
  SkeletonItem,
  Tag,
  TagGroup,
  CounterBadge,
  Rating,
  Textarea,
  Field,
  Toaster,
  useToastController,
  Toast,
  ToastTitle,
  ToastBody,
  ToastFooter,
  Toolbar,
  ToolbarButton,
  ToolbarDivider,
  ToolbarGroup,
  Drawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  InteractionTag,
  Select,
} from '@fluentui/react-components';
import {
  AddRegular,
  DeleteRegular,
  EditRegular,
  SettingsRegular,
  SearchRegular,
  PersonRegular,
  MoreVerticalRegular,
  HomeRegular,
  DocumentRegular,
  FolderRegular,
  ChevronRightRegular,
  DismissRegular,
  StarRegular,
  InfoRegular,
  ArrowRightRegular,
  CopyRegular,
  ShareRegular,
} from '@fluentui/react-icons';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalXL,
    maxWidth: '1200px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacingVerticalL,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  card: {
    padding: tokens.spacingVerticalL,
  },
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
});

export const ComponentsPage = () => {
  const styles = useStyles();
  const [progress, setProgress] = useState(45);
  const [sliderValue, setSliderValue] = useState(50);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');
  const [inputValue, setInputValue] = useState('');
  const [selectedOption, setSelectedOption] = useState('option1');
  const [selectedTab, setSelectedTab] = useState('tab1');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toggleChecked, setToggleChecked] = useState(false);
  const [comboboxValue, setComboboxValue] = useState('');
  const [spinButtonValue, setSpinButtonValue] = useState(10);
  const [ratingValue, setRatingValue] = useState(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Toast 控制器
  const toasterId = 'components-toaster';
  const { dispatchToast } = useToastController(toasterId);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title2>组件展示</Title2>
        <Body1>WinUI 3 风格组件，基于 Fluent UI React Components</Body1>
      </div>

      {/* 按钮组 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>按钮 (Buttons)</Title2>
          <Caption1>WinUI 3 风格的按钮组件，支持多种外观样式</Caption1>
          <div className={styles.row}>
            <Button appearance="primary" icon={<AddRegular />}>
              主要按钮
            </Button>
            <Button appearance="secondary" icon={<EditRegular />}>
              次要按钮
            </Button>
            <Button appearance="subtle" icon={<SettingsRegular />}>
              微妙按钮
            </Button>
            <Button appearance="outline">轮廓按钮</Button>
          </div>
          <div className={styles.row}>
            <Button appearance="primary" disabled>
              禁用按钮
            </Button>
            <Button appearance="secondary" icon={<DeleteRegular />}>
              删除
            </Button>
            <Button appearance="primary" size="small">
              小按钮
            </Button>
            <Button appearance="primary" size="large">
              大按钮
            </Button>
          </div>
        </div>
      </Card>

      {/* 按钮变体 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>按钮变体 (Button Variants)</Title2>
          <Caption1>特殊功能的按钮组件</Caption1>
          <div className={styles.column}>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>复合按钮 (CompoundButton)</Body1>
              <div className={styles.row}>
                <CompoundButton
                  secondaryContent="附带说明文字"
                  icon={<AddRegular />}
                >
                  创建新项目
                </CompoundButton>
                <CompoundButton
                  secondaryContent="附带说明文字"
                  appearance="outline"
                  icon={<EditRegular />}
                >
                  编辑项目
                </CompoundButton>
              </div>
            </div>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>菜单按钮 (MenuButton)</Body1>
              <div className={styles.row}>
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <MenuButton icon={<SettingsRegular />} menuIcon={<ChevronRightRegular />}>
                      设置菜单
                    </MenuButton>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem>选项 1</MenuItem>
                      <MenuItem>选项 2</MenuItem>
                      <MenuDivider />
                      <MenuItem>选项 3</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu>
                  <MenuTrigger disableButtonEnhancement>
                    <MenuButton appearance="secondary">打开菜单</MenuButton>
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem>选项 1</MenuItem>
                      <MenuItem>选项 2</MenuItem>
                      <MenuDivider />
                      <MenuItem>选项 3</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              </div>
            </div>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>分割按钮 (SplitButton)</Body1>
              <div className={styles.row}>
                <Menu positioning="below-end">
                  <MenuTrigger disableButtonEnhancement>
                    {(triggerProps) => (
                      <SplitButton
                        menuButton={triggerProps}
                        icon={<AddRegular />}
                      >
                        新建
                      </SplitButton>
                    )}
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem icon={<DocumentRegular />}>新建文档</MenuItem>
                      <MenuItem icon={<FolderRegular />}>新建文件夹</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
                <Menu positioning="below-end">
                  <MenuTrigger disableButtonEnhancement>
                    {(triggerProps) => (
                      <SplitButton
                        menuButton={triggerProps}
                        appearance="secondary"
                        icon={<EditRegular />}
                      >
                        编辑
                      </SplitButton>
                    )}
                  </MenuTrigger>
                  <MenuPopover>
                    <MenuList>
                      <MenuItem>编辑选项 1</MenuItem>
                      <MenuItem>编辑选项 2</MenuItem>
                    </MenuList>
                  </MenuPopover>
                </Menu>
              </div>
            </div>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>切换按钮 (ToggleButton)</Body1>
              <div className={styles.row}>
                <ToggleButton
                  checked={toggleChecked}
                  onChange={(_, data) => setToggleChecked(data.checked)}
                  icon={<SettingsRegular />}
                >
                  切换设置
                </ToggleButton>
                <ToggleButton
                  checked={toggleChecked}
                  onChange={(_, data) => setToggleChecked(data.checked)}
                  appearance="primary"
                >
                  主要切换
                </ToggleButton>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 输入控件 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>输入控件 (Input Controls)</Title2>
          <Caption1>文本输入、下拉选择等表单控件</Caption1>
          <div className={styles.column}>
            <Input
              placeholder="请输入文本..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              contentBefore={<SearchRegular />}
              style={{ maxWidth: '400px' }}
            />
            <Textarea
              placeholder="多行文本输入..."
              style={{ maxWidth: '400px' }}
              rows={3}
            />
            <Dropdown
              placeholder="选择选项"
              value={selectedOption}
              onOptionSelect={(_, data) => setSelectedOption(data.optionValue || '')}
              style={{ maxWidth: '400px' }}
            >
              <option value="option1">选项 1</option>
              <option value="option2">选项 2</option>
              <option value="option3">选项 3</option>
            </Dropdown>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>组合框 (Combobox) - 可搜索</Body1>
              <Combobox
                placeholder="输入或选择..."
                value={comboboxValue}
                onOptionSelect={(_, data) => setComboboxValue(data.optionText || '')}
                style={{ maxWidth: '400px' }}
              >
                <Option value="apple">苹果 (Apple)</Option>
                <Option value="banana">香蕉 (Banana)</Option>
                <Option value="cherry">樱桃 (Cherry)</Option>
                <Option value="date">枣子 (Date)</Option>
                <Option value="elderberry">接骨木 (Elderberry)</Option>
              </Combobox>
            </div>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>数字输入框 (SpinButton)</Body1>
              <SpinButton
                value={spinButtonValue}
                onChange={(_, data) => setSpinButtonValue(data.value ?? 0)}
                min={0}
                max={100}
                step={1}
                style={{ maxWidth: '200px' }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 选择控件 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>选择控件 (Selection Controls)</Title2>
          <Caption1>复选框、单选按钮、开关等选择组件</Caption1>
          <div className={styles.column}>
            <div className={styles.row}>
              <Checkbox
                checked={checkboxChecked}
                onChange={(_, data) => setCheckboxChecked(data.checked === true)}
                label="复选框选项"
              />
              <Switch
                checked={switchChecked}
                onChange={(_, data) => setSwitchChecked(data.checked || false)}
                label="开关控件"
              />
            </div>
            <RadioGroup
              value={radioValue}
              onChange={(_, data) => setRadioValue(data.value)}
            >
              <Radio label="单选选项 1" value="option1" />
              <Radio label="单选选项 2" value="option2" />
              <Radio label="单选选项 3" value="option3" />
            </RadioGroup>
          </div>
        </div>
      </Card>

      {/* 进度和滑块 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>进度和滑块 (Progress & Slider)</Title2>
          <Caption1>进度条和滑块控件</Caption1>
          <div className={styles.column}>
            <div>
              <Body1>进度条: {progress}%</Body1>
              <ProgressBar value={progress} max={100} />
              <div className={styles.row} style={{ marginTop: tokens.spacingVerticalS }}>
                <Button
                  size="small"
                  onClick={() => setProgress(Math.max(0, progress - 10))}
                >
                  -10%
                </Button>
                <Button
                  size="small"
                  onClick={() => setProgress(Math.min(100, progress + 10))}
                >
                  +10%
                </Button>
              </div>
            </div>
            <div>
              <Body1>滑块值: {sliderValue}</Body1>
              <Slider
                min={0}
                max={100}
                value={sliderValue}
                onChange={(_, data) => setSliderValue(data.value)}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 头像和徽章 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>头像和徽章 (Avatar & Badge)</Title2>
          <Caption1>用户头像和状态徽章组件</Caption1>
          <div className={styles.column}>
            <div className={styles.row}>
              <Avatar name="张三" size={64} />
              <Avatar name="李四" size={56} badge={{ status: 'available' }} />
              <Avatar name="王五" size={48} badge={{ status: 'busy' }} />
              <Avatar name="赵六" size={40} badge={{ status: 'away' }} />
              <Avatar name="钱七" size={32} badge={{ status: 'offline' }} />
              <Avatar icon={<PersonRegular />} size={64} shape="square" />
            </div>
            <div className={styles.row}>
              <Badge appearance="filled" color="brand">新</Badge>
              <Badge appearance="filled" color="success">成功</Badge>
              <Badge appearance="filled" color="warning">警告</Badge>
              <Badge appearance="filled" color="danger">错误</Badge>
              <Badge appearance="outline" color="brand">轮廓</Badge>
              <Badge appearance="tint" color="brand">浅色</Badge>
              <PresenceBadge status="available" />
              <PresenceBadge status="busy" />
              <PresenceBadge status="away" />
              <PresenceBadge status="offline" />
            </div>
          </div>
        </div>
      </Card>

      {/* 加载动画 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>加载动画 (Spinner)</Title2>
          <Caption1>用于显示加载状态的旋转动画</Caption1>
          <div className={styles.row}>
            <Spinner size="tiny" label="极小" />
            <Spinner size="extra-small" label="超小" />
            <Spinner size="small" label="小" />
            <Spinner size="medium" label="中" />
            <Spinner size="large" label="大" />
            <Spinner size="extra-large" label="超大" />
            <Spinner appearance="inverted" label="反转" />
          </div>
        </div>
      </Card>

      {/* 工具提示 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>工具提示 (Tooltip)</Title2>
          <Caption1>鼠标悬停时显示的提示信息</Caption1>
          <div className={styles.row}>
            <Tooltip content="这是一个工具提示" relationship="label">
              <Button>悬停查看提示</Button>
            </Tooltip>
            <Tooltip content="带箭头的提示" relationship="label" withArrow>
              <Button appearance="secondary">带箭头</Button>
            </Tooltip>
            <Tooltip content="反转样式的提示" relationship="label" appearance="inverted">
              <Button appearance="outline">反转样式</Button>
            </Tooltip>
          </div>
        </div>
      </Card>

      {/* 消息栏 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>消息栏 (MessageBar)</Title2>
          <Caption1>用于显示重要信息的消息栏组件</Caption1>
          <div className={styles.column}>
            <MessageBar intent="info">
              <MessageBarTitle>信息提示</MessageBarTitle>
              <MessageBarBody>
                这是一条信息类型的消息栏，用于向用户传达一般性信息。
              </MessageBarBody>
            </MessageBar>
            <MessageBar intent="success">
              <MessageBarTitle>成功提示</MessageBarTitle>
              <MessageBarBody>
                操作已成功完成！这是一条成功类型的消息栏。
              </MessageBarBody>
            </MessageBar>
            <MessageBar intent="warning">
              <MessageBarTitle>警告提示</MessageBarTitle>
              <MessageBarBody>
                请注意：这是一条警告类型的消息栏，提醒用户注意某些事项。
              </MessageBarBody>
            </MessageBar>
            <MessageBar intent="error">
              <MessageBarTitle>错误提示</MessageBarTitle>
              <MessageBarBody>
                发生错误！这是一条错误类型的消息栏，用于显示错误信息。
              </MessageBarBody>
            </MessageBar>
          </div>
        </div>
      </Card>

      {/* 列表 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>列表 (List)</Title2>
          <Caption1>用于展示列表数据的组件</Caption1>
          <List>
            <ListItem>
              <Text>列表项 1 - 这是第一个列表项</Text>
            </ListItem>
            <ListItem>
              <Text>列表项 2 - 这是第二个列表项</Text>
            </ListItem>
            <ListItem>
              <Text>列表项 3 - 这是第三个列表项</Text>
            </ListItem>
            <ListItem>
              <Text>列表项 4 - 这是第四个列表项</Text>
            </ListItem>
          </List>
        </div>
      </Card>

      {/* 分隔线 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>分隔线 (Divider)</Title2>
          <Caption1>用于分隔内容的视觉元素</Caption1>
          <div className={styles.column}>
            <Text>上方内容</Text>
            <Divider />
            <Text>中间内容</Text>
            <Divider appearance="strong" />
            <Text>下方内容</Text>
            <Divider vertical style={{ height: '40px' }} />
            <Text>垂直分隔线示例</Text>
          </div>
        </div>
      </Card>

      {/* 标签页 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>标签页 (Tabs)</Title2>
          <Caption1>用于在不同内容视图之间切换的标签页组件</Caption1>
          <TabList selectedValue={selectedTab} onTabSelect={(_, data) => setSelectedTab(data.value as string)}>
            <Tab value="tab1" icon={<HomeRegular />}>首页</Tab>
            <Tab value="tab2" icon={<DocumentRegular />}>文档</Tab>
            <Tab value="tab3" icon={<FolderRegular />}>文件夹</Tab>
          </TabList>
          <div style={{ padding: tokens.spacingVerticalM, minHeight: '100px' }}>
            {selectedTab === 'tab1' && <Body1>这是首页标签页的内容</Body1>}
            {selectedTab === 'tab2' && <Body1>这是文档标签页的内容</Body1>}
            {selectedTab === 'tab3' && <Body1>这是文件夹标签页的内容</Body1>}
          </div>
        </div>
      </Card>

      {/* 菜单 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>菜单 (Menu)</Title2>
          <Caption1>下拉菜单组件，用于显示操作选项</Caption1>
          <div className={styles.row}>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button icon={<MoreVerticalRegular />}>打开菜单</Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem icon={<EditRegular />}>编辑</MenuItem>
                  <MenuItem icon={<AddRegular />}>新建</MenuItem>
                  <MenuDivider />
                  <MenuItem icon={<DeleteRegular />}>删除</MenuItem>
                  <MenuItem icon={<SettingsRegular />}>设置</MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
            <Menu>
              <MenuTrigger disableButtonEnhancement>
                <Button appearance="secondary">更多选项</Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem>选项 1</MenuItem>
                  <MenuItem>选项 2</MenuItem>
                  <MenuDivider />
                  <MenuItem>选项 3</MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </div>
      </Card>

      {/* 对话框 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>对话框 (Dialog)</Title2>
          <Caption1>用于显示模态对话框的组件</Caption1>
          <div className={styles.row}>
            <Dialog open={dialogOpen} onOpenChange={(_, data) => setDialogOpen(data.open)}>
              <DialogTrigger disableButtonEnhancement>
                <Button appearance="primary">打开对话框</Button>
              </DialogTrigger>
              <DialogSurface>
                <DialogTitle>对话框标题</DialogTitle>
                <DialogBody>
                  <DialogContent>
                    <Body1>
                      这是一个对话框示例。您可以在这里显示重要的信息或收集用户输入。
                      对话框会阻止用户与页面其他部分交互，直到关闭。
                    </Body1>
                  </DialogContent>
                  <DialogActions>
                    <Button appearance="secondary" onClick={() => setDialogOpen(false)}>
                      取消
                    </Button>
                    <Button appearance="primary" onClick={() => setDialogOpen(false)}>
                      确认
                    </Button>
                  </DialogActions>
                </DialogBody>
              </DialogSurface>
            </Dialog>
          </div>
        </div>
      </Card>

      {/* 卡片布局示例 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: tokens.spacingVerticalM }}>
        <Card className={styles.card}>
          <div className={styles.column}>
            <Title2>功能卡片 1</Title2>
            <Body1>这是一个功能卡片示例，展示 WinUI 3 的卡片设计风格。</Body1>
            <Button appearance="primary">了解更多</Button>
          </div>
        </Card>
        <Card className={styles.card}>
          <div className={styles.column}>
            <Title2>功能卡片 2</Title2>
            <Body1>卡片支持丰富的内容布局，包括文本、按钮和其他组件。</Body1>
            <Button appearance="secondary">操作</Button>
          </div>
        </Card>
        <Card className={styles.card}>
          <div className={styles.column}>
            <Title2>功能卡片 3</Title2>
            <Body1>响应式布局，在不同屏幕尺寸下自动调整。</Body1>
            <Button appearance="outline">查看详情</Button>
          </div>
        </Card>
      </div>

      {/* 面包屑导航 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>面包屑导航 (Breadcrumb)</Title2>
          <Caption1>显示当前页面在导航层次结构中的位置</Caption1>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbButton icon={<HomeRegular />}>首页</BreadcrumbButton>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbButton>组件</BreadcrumbButton>
            </BreadcrumbItem>
            <BreadcrumbItem>
              <BreadcrumbButton current>面包屑</BreadcrumbButton>
            </BreadcrumbItem>
          </Breadcrumb>
        </div>
      </Card>

      {/* 链接 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>链接 (Link)</Title2>
          <Caption1>用于导航的链接组件</Caption1>
          <div className={styles.column}>
            <Link href="#" inline>
              内联链接
            </Link>
            <Link href="#" appearance="subtle">
              微妙链接
            </Link>
            <Link href="#" disabled>
              禁用链接
            </Link>
            <Link href="#" icon={<ArrowRightRegular />} iconPosition="after">
              带图标的链接
            </Link>
          </div>
        </div>
      </Card>

      {/* 弹出层 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>弹出层 (Popover)</Title2>
          <Caption1>非模态弹出层组件，用于显示额外内容</Caption1>
          <div className={styles.row}>
            <Popover open={popoverOpen} onOpenChange={(_, data) => setPopoverOpen(data.open)}>
              <PopoverTrigger disableButtonEnhancement>
                <Button>打开弹出层</Button>
              </PopoverTrigger>
              <PopoverSurface>
                <div style={{ padding: tokens.spacingVerticalM, minWidth: '200px' }}>
                  <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>弹出层内容</Body1>
                  <Body1>这是一个弹出层示例，可以显示额外的信息或操作。</Body1>
                  <div style={{ marginTop: tokens.spacingVerticalM }}>
                    <Button size="small" onClick={() => setPopoverOpen(false)}>
                      关闭
                    </Button>
                  </div>
                </div>
              </PopoverSurface>
            </Popover>
          </div>
        </div>
      </Card>

      {/* 手风琴 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>手风琴 (Accordion)</Title2>
          <Caption1>可折叠的内容面板组件</Caption1>
          <Accordion>
            <AccordionItem value="1">
              <AccordionHeader expandIconPosition="end" icon={<ChevronRightRegular />}>
                第一部分
              </AccordionHeader>
              <AccordionPanel>
                <Body1>这是第一部分的内容。可以包含任何类型的组件或文本。</Body1>
              </AccordionPanel>
            </AccordionItem>
            <AccordionItem value="2">
              <AccordionHeader expandIconPosition="end" icon={<ChevronRightRegular />}>
                第二部分
              </AccordionHeader>
              <AccordionPanel>
                <Body1>这是第二部分的内容。手风琴组件允许用户展开或折叠不同的部分。</Body1>
              </AccordionPanel>
            </AccordionItem>
            <AccordionItem value="3">
              <AccordionHeader expandIconPosition="end" icon={<ChevronRightRegular />}>
                第三部分
              </AccordionHeader>
              <AccordionPanel>
                <Body1>这是第三部分的内容。多个面板可以同时展开或折叠。</Body1>
              </AccordionPanel>
            </AccordionItem>
          </Accordion>
        </div>
      </Card>

      {/* 骨架屏 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>骨架屏 (Skeleton)</Title2>
          <Caption1>加载状态的占位组件</Caption1>
          <div className={styles.column}>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>文本骨架屏</Body1>
              <Skeleton>
                <SkeletonItem size={16} />
                <SkeletonItem size={16} style={{ width: '60%' }} />
              </Skeleton>
            </div>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>矩形骨架屏</Body1>
              <Skeleton>
                <SkeletonItem size={100} shape="rectangle" style={{ width: '200px', height: '100px' }} />
              </Skeleton>
            </div>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>圆形骨架屏</Body1>
              <Skeleton>
                <SkeletonItem size={64} shape="circle" />
              </Skeleton>
            </div>
          </div>
        </div>
      </Card>

      {/* 标签 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>标签 (Tags)</Title2>
          <Caption1>用于标记和分类的标签组件</Caption1>
          <div className={styles.column}>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>基础标签</Body1>
              <div className={styles.row}>
                <Tag>标签 1</Tag>
                <Tag appearance="outline">标签 2</Tag>
                <Tag appearance="brand">品牌标签</Tag>
                <Tag icon={<StarRegular />}>带图标</Tag>
                <Tag
                  icon={<DismissRegular />}
                  iconPosition="after"
                  onIconClick={() => {}}
                >
                  可删除
                </Tag>
              </div>
            </div>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>标签组 (TagGroup)</Body1>
              <TagGroup
                onDismiss={(_, data) => {
                  setSelectedTags(selectedTags.filter(tag => tag !== data.value));
                }}
              >
                <Tag value="tag1">React</Tag>
                <Tag value="tag2">TypeScript</Tag>
                <Tag value="tag3">Fluent UI</Tag>
                <Tag value="tag4">Electron</Tag>
              </TagGroup>
            </div>
          </div>
        </div>
      </Card>

      {/* 计数徽章 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>计数徽章 (CounterBadge)</Title2>
          <Caption1>显示数字计数的徽章组件</Caption1>
          <div className={styles.row}>
            <CounterBadge count={5} />
            <CounterBadge count={99} color="brand" />
            <CounterBadge count={999} color="danger" />
            <CounterBadge count={0} showZero={false} />
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <Button>通知</Button>
              <CounterBadge count={3} size="small" style={{ position: 'absolute', top: '-4px', right: '-4px' }} />
            </div>
          </div>
        </div>
      </Card>

      {/* 评分 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>评分 (Rating)</Title2>
          <Caption1>星级评分组件</Caption1>
          <div className={styles.column}>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>当前评分: {ratingValue} 星</Body1>
              <Rating
                value={ratingValue}
                onChange={(_, data) => setRatingValue(data.value)}
                count={5}
                size="large"
              />
            </div>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>只读评分</Body1>
              <Rating value={4} readOnly count={5} />
            </div>
          </div>
        </div>
      </Card>

      {/* 信息标签 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>信息标签 (InfoLabel)</Title2>
          <Caption1>带有信息提示的表单标签</Caption1>
          <div className={styles.column}>
            <Field label="用户名">
              <Input placeholder="请输入用户名" style={{ maxWidth: '400px' }} />
            </Field>
            <Field
              label={
                <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
                  <Text>邮箱地址</Text>
                  <Tooltip content="请输入有效的邮箱地址" relationship="label">
                    <Button
                      appearance="subtle"
                      icon={<InfoRegular />}
                      size="small"
                      style={{ minWidth: 'auto', padding: '2px 4px' }}
                    />
                  </Tooltip>
                </div>
              }
            >
              <Input placeholder="请输入邮箱" type="email" style={{ maxWidth: '400px' }} />
            </Field>
          </div>
        </div>
      </Card>

      {/* Toast 通知 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>Toast 通知 (Toast)</Title2>
          <Caption1>轻量级通知组件，用于显示临时消息</Caption1>
          <div className={styles.column}>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>不同类型的 Toast 通知</Body1>
              <div className={styles.row}>
                <Button
                  onClick={() =>
                    dispatchToast(
                      <Toast>
                        <ToastTitle>成功</ToastTitle>
                        <ToastBody>操作已成功完成！</ToastBody>
                      </Toast>,
                      { intent: 'success' }
                    )
                  }
                >
                  显示成功通知
                </Button>
                <Button
                  onClick={() =>
                    dispatchToast(
                      <Toast>
                        <ToastTitle>信息</ToastTitle>
                        <ToastBody>这是一条信息提示。</ToastBody>
                      </Toast>,
                      { intent: 'info' }
                    )
                  }
                >
                  显示信息通知
                </Button>
                <Button
                  onClick={() =>
                    dispatchToast(
                      <Toast>
                        <ToastTitle>警告</ToastTitle>
                        <ToastBody>请注意：这是一个警告消息。</ToastBody>
                      </Toast>,
                      { intent: 'warning' }
                    )
                  }
                >
                  显示警告通知
                </Button>
                <Button
                  onClick={() =>
                    dispatchToast(
                      <Toast>
                        <ToastTitle>错误</ToastTitle>
                        <ToastBody>操作失败，请重试。</ToastBody>
                      </Toast>,
                      { intent: 'error' }
                    )
                  }
                >
                  显示错误通知
                </Button>
              </div>
            </div>
            <div>
              <Body1 style={{ marginBottom: tokens.spacingVerticalS }}>带操作的 Toast</Body1>
              <Button
                onClick={() =>
                  dispatchToast(
                    <Toast>
                      <ToastTitle>文件已复制</ToastTitle>
                      <ToastBody>文件已成功复制到剪贴板。</ToastBody>
                      <ToastFooter>
                        <Button appearance="subtle" size="small">
                          撤销
                        </Button>
                      </ToastFooter>
                    </Toast>,
                    { intent: 'success' }
                  )
                }
              >
                显示带操作的 Toast
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <Toaster toasterId={toasterId} />

      {/* 工具栏 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>工具栏 (Toolbar)</Title2>
          <Caption1>用于组织和展示操作按钮的工具栏组件</Caption1>
          <div className={styles.column}>
            <Toolbar>
              <ToolbarGroup>
                <ToolbarButton icon={<EditRegular />}>编辑</ToolbarButton>
                <ToolbarButton icon={<DeleteRegular />}>删除</ToolbarButton>
                <ToolbarDivider />
                <ToolbarButton icon={<CopyRegular />}>复制</ToolbarButton>
                <ToolbarButton icon={<ShareRegular />}>分享</ToolbarButton>
              </ToolbarGroup>
            </Toolbar>
            <Toolbar>
              <ToolbarGroup>
                <ToolbarButton icon={<AddRegular />} appearance="primary">
                  新建
                </ToolbarButton>
                <ToolbarButton icon={<EditRegular />}>编辑</ToolbarButton>
              </ToolbarGroup>
              <ToolbarDivider />
              <ToolbarGroup>
                <ToolbarButton icon={<SettingsRegular />}>设置</ToolbarButton>
              </ToolbarGroup>
            </Toolbar>
          </div>
        </div>
      </Card>

      {/* 分页 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>分页 (Pagination)</Title2>
          <Caption1>用于在多个页面之间导航的分页组件</Caption1>
          <div>
            <Body1>Pagination 组件需要从单独的包导入，当前主包中不包含此组件。</Body1>
            <Body1 style={{ marginTop: tokens.spacingVerticalS, color: tokens.colorNeutralForeground3 }}>
              如需使用 Pagination 组件，请参考 Fluent UI 文档了解正确的导入方式。
            </Body1>
          </div>
        </div>
      </Card>

      {/* 抽屉 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>抽屉 (Drawer)</Title2>
          <Caption1>侧边栏抽屉组件，用于显示额外内容或导航</Caption1>
          <div className={styles.row}>
            <Button onClick={() => setDrawerOpen(true)}>打开抽屉</Button>
          </div>
        </div>
      </Card>
      <Drawer type="overlay" open={drawerOpen} onOpenChange={(_, data) => setDrawerOpen(data.open)}>
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                aria-label="关闭抽屉"
                icon={<DismissRegular />}
                onClick={() => setDrawerOpen(false)}
              />
            }
          >
            抽屉标题
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>
          <div className={styles.column} style={{ padding: tokens.spacingVerticalM }}>
            <Body1>这是抽屉内容区域。</Body1>
            <Body1>您可以在这里放置任何内容，比如导航菜单、设置选项等。</Body1>
            <div style={{ marginTop: tokens.spacingVerticalM }}>
              <Button appearance="primary" onClick={() => setDrawerOpen(false)}>
                关闭
              </Button>
            </div>
          </div>
        </DrawerBody>
      </Drawer>

      {/* 导航菜单 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>导航菜单 (Nav)</Title2>
          <Caption1>用于导航的菜单组件</Caption1>
          <div style={{ maxWidth: '300px', border: `1px solid ${tokens.colorNeutralStroke2}`, borderRadius: tokens.borderRadiusMedium, padding: tokens.spacingVerticalM }}>
            <Body1>Nav 组件需要从 @fluentui/react-nav 包导入，当前主包中不包含此组件。</Body1>
            <Body1 style={{ marginTop: tokens.spacingVerticalS, color: tokens.colorNeutralForeground3 }}>
              如需使用 Nav 组件，请安装: pnpm add @fluentui/react-nav
            </Body1>
          </div>
        </div>
      </Card>

      {/* 交互式标签 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>交互式标签 (InteractionTag)</Title2>
          <Caption1>可交互的标签组件，支持点击和悬停效果</Caption1>
          <div className={styles.row}>
            <InteractionTag>可点击标签</InteractionTag>
            <InteractionTag appearance="outline">轮廓样式</InteractionTag>
            <InteractionTag appearance="brand">品牌样式</InteractionTag>
            <InteractionTag
              icon={<StarRegular />}
              iconPosition="before"
              onClick={() => {}}
            >
              带图标
            </InteractionTag>
          </div>
        </div>
      </Card>

      {/* Select 选择器 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>Select 选择器</Title2>
          <Caption1>原生 HTML select 元素的封装，提供更好的样式</Caption1>
          <div className={styles.column}>
            <Field label="选择颜色">
              <Select id="color-select" style={{ maxWidth: '400px' }}>
                <option value="red">红色</option>
                <option value="green">绿色</option>
                <option value="blue">蓝色</option>
                <option value="yellow">黄色</option>
              </Select>
            </Field>
            <Field label="选择大小">
              <Select id="size-select" size="large" style={{ maxWidth: '400px' }}>
                <option value="small">小</option>
                <option value="medium">中</option>
                <option value="large">大</option>
              </Select>
            </Field>
          </div>
        </div>
      </Card>

      {/* 状态信息 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>当前状态</Title2>
          <div className={styles.column}>
            <Text>输入值: {inputValue || '(空)'}</Text>
            <Text>下拉选择: {selectedOption}</Text>
            <Text>组合框值: {comboboxValue || '(空)'}</Text>
            <Text>数字输入: {spinButtonValue}</Text>
            <Text>复选框: {checkboxChecked ? '已选中' : '未选中'}</Text>
            <Text>开关: {switchChecked ? '开启' : '关闭'}</Text>
            <Text>切换按钮: {toggleChecked ? '开启' : '关闭'}</Text>
            <Text>单选值: {radioValue}</Text>
            <Text>评分: {ratingValue} 星</Text>
            <Text>进度: {progress}%</Text>
            <Text>滑块: {sliderValue}</Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

