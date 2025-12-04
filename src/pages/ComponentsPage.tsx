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
} from '@fluentui/react-components';
import {
  AddRegular,
  DeleteRegular,
  EditRegular,
  SettingsRegular,
  SearchRegular,
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

