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

      {/* 状态信息 */}
      <Card className={styles.card}>
        <div className={styles.section}>
          <Title2>当前状态</Title2>
          <div className={styles.column}>
            <Text>输入值: {inputValue || '(空)'}</Text>
            <Text>下拉选择: {selectedOption}</Text>
            <Text>复选框: {checkboxChecked ? '已选中' : '未选中'}</Text>
            <Text>开关: {switchChecked ? '开启' : '关闭'}</Text>
            <Text>单选值: {radioValue}</Text>
            <Text>进度: {progress}%</Text>
            <Text>滑块: {sliderValue}</Text>
          </div>
        </div>
      </Card>
    </div>
  );
};

