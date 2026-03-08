import { useNavigate } from 'react-router-dom';
import { Button, Card, Typography, Statistic, Row, Col, Table, Input, Space, Tag } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

export const HomePage = () => {
  const navigate = useNavigate();

  const taskColumns = [
    { title: '任务', dataIndex: 'task', key: 'task' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === '完成' ? 'success' : 'processing'}>{status}</Tag>
      ),
    },
  ];

  const taskData = [
    { key: '1', task: '文生图批处理', status: '完成' },
  ];

  return (
    <div className="pencil-page">
      <header className="pencil-page-header">
        <div className="pencil-page-title-row">
          <Title level={2} style={{ margin: 0 }}>主页</Title>
          <Tag color="blue">OVERVIEW</Tag>
        </div>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          总览模型、任务状态与最新生成记录。
        </Paragraph>
      </header>

      <Card style={{ marginBottom: 24 }}>
        <Title level={4}>欢迎使用 HelloUI</Title>
        <Paragraph type="secondary">统一入口管理模型、推理引擎与节点式多模态工作流。</Paragraph>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/studio')}>
          打开工作台
        </Button>
      </Card>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic title="今日生成任务" value={48} suffix={<Tag color="green">+12%</Tag>} />
          </Card>
        </Col>
        <Col xs={24} sm={12}>
          <Card>
            <Statistic title="已就绪模型组" value={9} suffix={<Tag>稳定</Tag>} />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 24 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input.Search placeholder="搜索任务或结果..." style={{ width: 300 }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/studio')}>
            新建工作流
          </Button>
        </Space>
        <Table
          columns={taskColumns}
          dataSource={taskData}
          pagination={{ pageSize: 10, size: 'small' }}
          size="small"
        />
        <Text type="secondary" style={{ fontSize: 12 }}>显示最近 10 条记录</Text>
      </Card>

      <Card size="small">
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--muted-foreground)', display: 'inline-block' }} />
            <Text type="secondary">引擎状态：未载入（显存占用 0 GB）</Text>
          </Space>
          <Button type="text" icon={<ThunderboltOutlined />} onClick={() => navigate('/sdcpp')}>
            [ Space ] 载入 / 卸载引擎
          </Button>
        </Space>
      </Card>
    </div>
  );
};

export default HomePage;
