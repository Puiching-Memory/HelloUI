import { useNavigate } from 'react-router-dom';
import './HomePage.css';

export const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page pencil-page">
      <header className="home-header pencil-page-header">
        <div className="pencil-page-title-row">
          <h1 className="pencil-page-title">主页</h1>
          <span className="pencil-page-kicker">OVERVIEW</span>
        </div>
        <p className="pencil-page-description">总览模型、任务状态与最新生成记录。</p>
      </header>

      <section className="home-card home-hero">
        <h2>欢迎使用 HelloUI</h2>
        <p>统一入口管理模型、推理引擎与节点式多模态工作流。</p>
        <button className="home-outline-btn" type="button" onClick={() => navigate('/studio')}>
          <span>+</span>
          打开工作台
        </button>
      </section>

      <section className="home-metrics">
        <article className="home-card home-metric-card">
          <h3>今日生成任务</h3>
          <p className="home-metric-value">48</p>
          <span className="home-badge">+12%</span>
        </article>
        <article className="home-card home-metric-card">
          <h3>已就绪模型组</h3>
          <p className="home-metric-value">9</p>
          <span className="home-badge">稳定</span>
        </article>
      </section>

      <section className="home-table">
        <div className="home-table-header">
          <input aria-label="搜索任务或结果" value="" placeholder="搜索任务或结果..." readOnly />
          <button className="home-outline-btn home-outline-btn-wide" type="button" onClick={() => navigate('/studio')}>
            <span>+</span>
            新建工作流
          </button>
        </div>

        <div className="home-table-content">最近任务：文生图批处理 / 完成</div>

        <div className="home-table-footer">
          <span>显示最近 10 条记录</span>
          <div className="home-pagination">
            <button type="button">Previous</button>
            <button type="button">Next</button>
          </div>
        </div>
      </section>

      <footer className="home-status">
        <div className="home-status-left">
          <span className="home-status-dot" />
          引擎状态：未载入（显存占用 0 GB）
        </div>
        <button type="button" onClick={() => navigate('/sdcpp')}>
          [ Space ] 载入 / 卸载引擎
        </button>
      </footer>
    </div>
  );
};

export default HomePage;
