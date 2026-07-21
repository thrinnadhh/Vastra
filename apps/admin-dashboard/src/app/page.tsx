export default function AdminFoundationPage(): React.JSX.Element {
  return (
    <section aria-labelledby="foundation-title" className="foundation">
      <div className="foundation__panel">
        <p className="foundation__eyebrow">Vastra operations</p>

        <h1 id="foundation-title">Vastra Admin — foundation ready</h1>

        <p className="foundation__description">
          The administration workspace is installed and ready for future approved capabilities.
        </p>

        <p className="foundation__status" role="status">
          System shell available
        </p>
      </div>
    </section>
  );
}
