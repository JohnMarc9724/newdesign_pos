import ApexCharts from "apexcharts";

const chartIngredientsPie = () => {
  const options = {
    series: [44, 33, 22, 11],
    labels: ["Flour", "Sugar", "Milk", "Butter"],
    colors: ["#465FFF", "#9CB9FF", "#34D399", "#F59E0B"],
    chart: {
      type: "pie",
      height: 300,
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
    },
    legend: {
      position: "bottom",
      fontFamily: "Outfit, sans-serif",
      markers: { radius: 99 },
    },
    dataLabels: {
      enabled: true,
      formatter: function (val) {
        return Math.round(val) + "%";
      },
    },
    stroke: { colors: ["#fff"] },
  };

  const el = document.querySelector("#chartIngredientsPie");
  if (el) {
    const chart = new ApexCharts(el, options);
    chart.render();
  }
};

export default chartIngredientsPie;


