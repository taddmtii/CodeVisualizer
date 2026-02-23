type HeaderProps = {
  page: 'view' | 'predict';
  setPage: (mode: 'view' | 'predict') => void;
};

function Header({ page, setPage }: HeaderProps) {
  const isSelected = page === 'view' ? 'view' : 'predict';
  return (
    <>
      {/* Main container */}
      <div className="flex w-100vw p-4 bg-[#3D3D3D] justify-between">
        {/* Code Visualizer title */}
        <div className="flex gap-4 ml-4">
          <h1 className="flex text-white text-2xl ">CodeVisualizer</h1>
          <a href="https://github.com/taddmtii/CodeVisualizer/blob/main/Documentation/PyVizDocumentation.md" target="_blank">
            <button
              className={`btn text-white font-bold bg-[#242424] hover:bg-[#343434] py-2 px-2 cursor-pointer rounded`}
            >
              Documentation
            </button>
          </a>
        </div>
        {/* Controls */}
        <div className="flex gap-4 mr-4">
          <button
            className={`btn ${isSelected === 'view' ? 'bg-blue-500' : 'bg-[#242424] hover:bg-[#343434]'} text-white font-bold py-2 px-4 cursor-pointer rounded`}
            onClick={() => setPage('view')}
          >
            View
          </button>
          <button
            className={`btn ${isSelected === 'predict' ? 'bg-blue-500' : 'bg-[#242424] hover:bg-[#343434]'} text-white font-bold py-2 px-4 cursor-pointer rounded`}
            onClick={() => setPage('predict')}
          >
            Predict
          </button>
        </div>
      </div>
    </>
  );
}

export default Header;
