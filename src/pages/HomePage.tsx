import type { ReactNode } from 'react'
import {
  ArrowRightOutlined,
  FolderOpenOutlined,
  RocketOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import './HomePage.css'

const { Title, Text } = Typography

type OnboardingStep = {
  action: string
  description: string
  icon: ReactNode
  index: string
  key: string
  path: string
  title: string
}

const onboardingSteps: OnboardingStep[] = [
  {
    action: '打开引擎管理',
    description: '先下载或切换 SD.cpp，确认本机设备和推理环境可以正常工作。',
    icon: <ThunderboltOutlined />,
    index: '1',
    key: 'engine',
    path: '/sdcpp',
    title: '准备引擎',
  },
  {
    action: '打开模型权重管理',
    description: '设置模型目录、导入模型组，并保存一套常用的默认参数。',
    icon: <FolderOpenOutlined />,
    index: '2',
    key: 'weights',
    path: '/weights',
    title: '准备模型',
  },
  {
    action: '打开节点工作台',
    description: '进入节点工作台连接提示词、模型和输出，直接开始生成内容。',
    icon: <RocketOutlined />,
    index: '3',
    key: 'studio',
    path: '/studio',
    title: '开始创作',
  },
]

export const HomePage = () => {
  const navigate = useNavigate()

  return (
    <div className="app-page home-page">
      <section className="app-page-header home-hero">
        <div className="home-hero-copy">
          <Title level={1} className="app-page-title home-hero-title">
            打开应用，三步开始创作
          </Title>
        </div>

        <div className="home-demo-panel">
          <div className="home-demo-window">
            <div className="home-demo-body">
              <div className="home-stage-bar" aria-hidden="true">
                {onboardingSteps.map((step) => (
                  <div className="home-stage-item" key={step.key}>
                    <span className="home-stage-item-circle">{step.index}</span>
                    <span className="home-stage-item-label">{step.title}</span>
                  </div>
                ))}
              </div>

              <div className="home-stage-caption">
                <Text className="home-stage-caption-text">推荐顺序：先准备引擎，再准备模型，最后进入节点工作台。</Text>
              </div>

              <div className="home-demo-grid">
                {onboardingSteps.map((step) => (
                  <button className={`home-demo-card home-demo-card--${step.key}`} key={step.key} onClick={() => navigate(step.path)} type="button">
                    <span className="home-demo-card-head">
                      <span className="home-demo-card-index">STEP {step.index}</span>
                      <span className="home-demo-card-icon">{step.icon}</span>
                    </span>

                    <span className="home-demo-card-title">{step.title}</span>
                    <span className="home-demo-card-description">{step.description}</span>

                    <span className="home-demo-card-action">
                      {step.action}
                      <ArrowRightOutlined />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
