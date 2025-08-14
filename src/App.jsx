import React, { useMemo, useState } from "react";
import { ConfigProvider, theme, Typography, Card, Space, Select, InputNumber, Radio, Row, Col, Divider, Alert, Button, Tooltip, message } from "antd";
import { InfoCircleOutlined, ReloadOutlined, CopyOutlined } from "@ant-design/icons";
// 提示：在你的入口文件（例如 main.jsx / index.jsx）里记得引入 antd 样式：
// import 'antd/dist/reset.css'; // antd v5 推荐

const { Title, Text, Paragraph } = Typography;

// 品种配置（JS 版本）
const PRODUCTS = {
  玻璃: { margin: 0.11, leverage: 20 },
  焦煤: { margin: 0.13, leverage: 60 },
  烧碱: { margin: 0.09, leverage: 30 },
  棕榈油: { margin: 0.09, leverage: 10 },
  螺纹钢: { margin: 0.08, leverage: 10 },
  氧化铝: { margin: 0.12, leverage: 20 },
};

// 帮助方法
function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function floorIfValid(n) {
  if (!isFiniteNumber(n)) return 0;
  if (n < 0) return 0;
  return Math.floor(n);
}

export default function App() {
  const [product, setProduct] = useState("玻璃");
  const [price, setPrice] = useState(null);
  const [atr, setAtr] = useState(null);
  const [balance, setBalance] = useState(null);
  const [direction, setDirection] = useState("long"); // "long" | "short"

  const cfg = useMemo(() => (product ? PRODUCTS[product] : undefined), [product]);
  const marginRatio = cfg ? cfg.margin : 0; // 比例（0.11 表示 11%）
  const leverage = cfg ? cfg.leverage : 0;

  // 交易数量计算规则：
  // 数量1 = 2% / (ATR * 杠杆倍数 / 仓位余额) 向下取整
  // 数量2 = 仓位余额 * 0.4 / (价格 * 保证金比例 * 杠杆倍数) 向下取整
  // 交易数量 = min(数量1, 数量2)
  const qty = useMemo(() => {
    if (!isFiniteNumber(leverage) || leverage <= 0) return 0;
    if (!isFiniteNumber(balance) || balance <= 0) return 0;

    const _atr = atr ?? NaN;
    const _price = price ?? NaN;
    const _margin = marginRatio;

    const q1Raw = 0.02 / ((_atr * leverage) / balance);
    const q2Raw = (balance * 0.4) / (_price * _margin * leverage);

    const q1 = floorIfValid(q1Raw);
    const q2 = floorIfValid(q2Raw);

    const res = Math.min(q1, q2);
    if (!Number.isFinite(res) || res < 0) return 0;
    return res;
  }, [atr, price, balance, marginRatio, leverage]);

  // 止损 & 止盈（做多与做空对称处理；题面仅给出做多公式，这里对做空做常见对称假设）
  const levels = useMemo(() => {
    const _p = price ?? NaN;
    const _a = atr ?? NaN;
    if (!isFiniteNumber(_p) || !isFiniteNumber(_a)) {
      return { sl: NaN, tp1: NaN, tp2: NaN, tp3: NaN, tp4: NaN };
    }
    if (direction === "long") {
      return {
        sl: _p - _a,
        tp1: _p + 1 * _a,
        tp2: _p + 1.5 * _a,
        tp3: _p + 2 * _a,
        tp4: _p + 3 * _a,
      };
    }
    // 做空的对称处理
    return {
      sl: _p + _a,
      tp1: _p - 1 * _a,
      tp2: _p - 1.5 * _a,
      tp3: _p - 2 * _a,
      tp4: _p - 3 * _a,
    };
  }, [price, atr, direction]);

  const { sl, tp1, tp2, tp3, tp4 } = levels;
  const canCopy = useMemo(() => qty > 0 && isFiniteNumber(sl) && isFiniteNumber(tp1), [qty, sl, tp1]);

  const onReset = () => {
    setPrice(null);
    setAtr(null);
    setBalance(null);
    setDirection("long");
  };

  const copyPlan = async () => {
    const payload = {
      品种: product,
      方向: direction === "long" ? "做多" : "做空",
      输入: { 价格: price, ATR: atr, 仓位余额: balance, 保证金比例: marginRatio, 杠杆倍数: leverage },
      计算: {
        交易数量: qty,
        止损价格: isFiniteNumber(sl) ? Number(sl.toFixed(2)) : null,
        止盈一档: isFiniteNumber(tp1) ? Number(tp1.toFixed(2)) : null,
        止盈二档: isFiniteNumber(tp2) ? Number(tp2.toFixed(2)) : null,
        止盈三档: isFiniteNumber(tp3) ? Number(tp3.toFixed(2)) : null,
        止盈四档: isFiniteNumber(tp4) ? Number(tp4.toFixed(2)) : null,
      },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      message.success("参数已复制到剪贴板");
    } catch (e) {
      message.error("复制失败，请手动选择文本复制");
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          borderRadius: 14,
          fontSize: 14,
        },
      }}
    >
      <div className="min-h-screen p-6 bg-[#0f172a]">
        <div className="max-w-5xl mx-auto">
          <Title level={2} style={{ color: "#e2e8f0", marginBottom: 12 }}>
            自动计算器 · 期货
          </Title>
          <Text style={{ color: "#94a3b8" }}>
            选择品种并输入价格、ATR、仓位余额与方向后，系统自动计算建议的交易数量、止损与止盈区间。
          </Text>

          <Space direction="vertical" size={16} style={{ width: "100%", marginTop: 16 }}>
            <Card>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={8}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Text strong>品种</Text>
                    <Select
                      options={Object.keys(PRODUCTS).map((k) => ({ label: k, value: k }))}
                      value={product}
                      style={{ width: 200 }}
                      onChange={setProduct}
                      placeholder="选择品种"
                    />
                  </Space>
                </Col>

                <Col xs={24} md={16}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text strong>价格</Text>
                        <InputNumber
                          style={{ width: "100%" }}
                          placeholder="输入当前价格"
                          value={price}
                          min={0}
                          precision={2}
                          onChange={setPrice}
                        />
                      </Space>
                    </Col>

                    <Col xs={24} md={12}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text strong>ATR</Text>
                        <InputNumber
                          style={{ width: "100%" }}
                          placeholder="输入 ATR"
                          value={atr}
                          min={0}
                          precision={2}
                          onChange={setAtr}
                        />
                      </Space>
                    </Col>

                    <Col xs={24} md={12}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text strong>仓位余额</Text>
                        <InputNumber
                          style={{ width: "100%" }}
                          placeholder="账户可用余额"
                          value={balance}
                          min={0}
                          precision={2}
                          onChange={setBalance}
                        />
                      </Space>
                    </Col>

                    <Col xs={24} md={12}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text strong>交易方向</Text>
                        <Radio.Group
                          optionType="button"
                          buttonStyle="solid"
                          value={direction}
                          onChange={(e) => setDirection(e.target.value)}
                          options={[
                            { label: "做多", value: "long" },
                            { label: "做空", value: "short" },
                          ]}
                        />
                      </Space>
                    </Col>
                  </Row>
                </Col>
              </Row>

              <Divider />

              <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Text strong>
                      保证金比例
                      <Tooltip title="根据品种自动设定">
                        <InfoCircleOutlined style={{ marginLeft: 6 }} />
                      </Tooltip>
                    </Text>
                    <InputNumber
                      style={{ width: "100%" }}
                      value={marginRatio * 100}
                      addonAfter="%"
                      disabled
                    />
                  </Space>
                </Col>
                <Col xs={24} md={6}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Text strong>
                      杠杆倍数
                      <Tooltip title="根据品种自动设定">
                        <InfoCircleOutlined style={{ marginLeft: 6 }} />
                      </Tooltip>
                    </Text>
                    <InputNumber style={{ width: "100%" }} value={leverage} disabled />
                  </Space>
                </Col>

                <Col xs={24} md={12}>
                  <Alert
                    type="info"
                    showIcon
                    message={
                      <span>
                        交易数量 = 两个规则分别取整后的较小值：
                        <br />
                        ① <Text code>0.02 / (ATR × 杠杆 / 余额)</Text>
                        ，② <Text code>余额×0.4 / (价格×保证金×杠杆)</Text>
                      </span>
                    }
                  />
                </Col>
              </Row>
            </Card>

            <Card>
              <Row gutter={[16, 16]}>
                <Col xs={24} md={6}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Text strong>交易数量（手）</Text>
                    <InputNumber style={{ width: "100%" }} value={qty} precision={0} disabled />
                  </Space>
                </Col>

                <Col xs={24} md={6}>
                  <Space direction="vertical" style={{ width: "100%" }}>
                    <Text strong>止损价格</Text>
                    <InputNumber style={{ width: "100%" }} value={isFiniteNumber(sl) ? Number(sl.toFixed(2)) : undefined} disabled />
                  </Space>
                </Col>

                <Col xs={24} md={12}>
                  <Row gutter={[16, 16]}>
                    <Col xs={24} md={12}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text strong>止盈一档</Text>
                        <InputNumber style={{ width: "100%" }} value={isFiniteNumber(tp1) ? Number(tp1.toFixed(2)) : undefined} disabled />
                      </Space>
                    </Col>
                    <Col xs={24} md={12}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text strong>止盈二档</Text>
                        <InputNumber style={{ width: "100%" }} value={isFiniteNumber(tp2) ? Number(tp2.toFixed(2)) : undefined} disabled />
                      </Space>
                    </Col>
                    <Col xs={24} md={12}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text strong>止盈三档</Text>
                        <InputNumber style={{ width: "100%" }} value={isFiniteNumber(tp3) ? Number(tp3.toFixed(2)) : undefined} disabled />
                      </Space>
                    </Col>
                    <Col xs={24} md={12}>
                      <Space direction="vertical" style={{ width: "100%" }}>
                        <Text strong>止盈四档</Text>
                        <InputNumber style={{ width: "100%" }} value={isFiniteNumber(tp4) ? Number(tp4.toFixed(2)) : undefined} disabled />
                      </Space>
                    </Col>
                  </Row>
                </Col>
              </Row>

              <Divider />

              <Space>
                <Button icon={<ReloadOutlined />} onClick={onReset}>重置输入</Button>
                <Button type="primary" disabled={!canCopy} icon={<CopyOutlined />} onClick={copyPlan}>
                  复制参数
                </Button>
              </Space>
            </Card>

            <Card>
              <Title level={4} style={{ marginTop: 0 }}>说明</Title>
              <Paragraph style={{ marginBottom: 8 }}>
                1）题面仅明确了做多的止损/止盈规则，本工具对做空采取对称处理（止损=价格+ATR，止盈依次为价格减去1×/1.5×/2×/3×ATR）。如需不同逻辑，可在代码中修改。
              </Paragraph>
              <Paragraph style={{ marginBottom: 0 }}>
                2）若输入不完整或数值≤0，将不会给出数量与价格；数量向下取整，最小为0。
              </Paragraph>
            </Card>
          </Space>
        </div>
      </div>
    </ConfigProvider>
  );
}